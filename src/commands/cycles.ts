import type { Group } from "../cli/dispatch.ts";
import { cmd, line, next } from "../render/output.ts";
import * as views from "../render/views.ts";

const DATE_FLAGS = { "start-date": "start_date", "end-date": "end_date" };

export const cycles: Group = {
  summary: "Cycles (sprints)",
  commands: {
    list: {
      usage: "cycles list",
      summary: "List the project's cycles",
      async run({ project }) {
        views.cycles(await project.cycles.list(), project.id);
      },
    },

    create: {
      usage: "cycles create --name=<text> [--start-date=YYYY-MM-DD] [--end-date=YYYY-MM-DD] [--description=<text>]",
      writes: { action: "create", what: "cycle" },
      summary: "Create a cycle",
      async run({ project, args }) {
        const created = await project.cycles.create({
          name: args.require("name"),
          ...args.payload({ ...DATE_FLAGS, description: "description" }),
        });
        line(`Created cycle '${created.name}'  ID: ${created.id}`);
        next([
          `${cmd(project.id)} cycles list`,
          `${cmd(project.id)} cycles add-items ${created.id} --item=<item-id>`,
        ]);
      },
    },

    update: {
      usage: "cycles update <cycle-id> [--name=<text>] [--start-date=YYYY-MM-DD] [--end-date=YYYY-MM-DD] [--description=<text>]",
      writes: { action: "update", what: "cycle" },
      summary: "Change a cycle's name, dates or description",
      async run({ project, args }) {
        const cycleId = args.at(0, "<cycle-id>");
        const payload = args.requireSome(
          args.payload({ name: "name", ...DATE_FLAGS, description: "description" }),
          "--name, --start-date, --end-date and/or --description"
        );
        const updated = await project.cycles.update(cycleId, payload);
        line(`Updated cycle '${updated.name}'  ID: ${updated.id}`);
      },
    },

    delete: {
      usage: "cycles delete <cycle-id>",
      writes: { action: "delete", what: "cycle" },
      summary: "Delete a cycle",
      async run({ project, args }) {
        const cycleId = args.at(0, "<cycle-id>");
        await project.cycles.remove(cycleId);
        line(`Deleted cycle ${cycleId}`);
      },
    },

    "add-items": {
      usage: "cycles add-items <cycle-id> --item=<item-id>[,<item-id>]",
      writes: { action: "update", what: "cycle membership" },
      summary: "Put work items into a cycle",
      async run({ project, args }) {
        const cycleId = args.at(0, "<cycle-id>");
        const itemIds = args.requireList("item");
        await project.cycles.addItems(cycleId, itemIds);
        line(`Added ${itemIds.length} item(s) to cycle ${cycleId}`);
        next([`${cmd(project.id)} cycles list`]);
      },
    },

    "remove-item": {
      usage: "cycles remove-item <cycle-id> <item-id>",
      writes: { action: "update", what: "cycle membership" },
      summary: "Take one work item out of a cycle",
      async run({ project, args }) {
        const cycleId = args.at(0, "<cycle-id>");
        const itemId = args.at(1, "<item-id>");
        await project.cycles.removeItem(cycleId, itemId);
        line(`Removed item ${itemId} from cycle ${cycleId}`);
      },
    },
  },
};

/** `items cycle …` — the cycle one work item belongs to. */
export const itemCycle: Group = {
  summary: "The cycle a work item belongs to",
  commands: {
    set: {
      usage: "items cycle set <item-id> --cycle=<name|uuid>",
      writes: { action: "update", what: "cycle assignment" },
      summary: "Move the item into a cycle",
      async run({ project, args }) {
        const itemId = args.at(0, "<item-id>");
        const cycleId = await project.resolveCycle(args.require("cycle"));
        await project.cycles.addItems(cycleId, [itemId]);
        line(`Added item ${itemId} to cycle ${cycleId}`);
        next([`${cmd(project.id)} items show ${itemId}`]);
      },
    },

    remove: {
      usage: "items cycle remove <item-id>",
      writes: { action: "update", what: "cycle assignment" },
      summary: "Take the item out of whichever cycle it is in",
      async run({ project, args }) {
        const itemId = args.at(0, "<item-id>");
        const item = await project.items.get(itemId);
        if (!item.cycle) {
          line("Item is not in any cycle.");
          return;
        }
        await project.cycles.removeItem(item.cycle, itemId);
        line(`Removed item ${itemId} from cycle ${item.cycle}`);
      },
    },
  },
};
