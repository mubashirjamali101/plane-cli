import type { Group } from "../cli/dispatch.ts";
import { fail } from "../errors.ts";
import { line, next, cmd } from "../render/output.ts";
import * as views from "../render/views.ts";

const GROUPS = ["backlog", "unstarted", "started", "completed", "cancelled"];

export const states: Group = {
  summary: "Workflow states",
  commands: {
    list: {
      usage: "states list",
      summary: "List the project's states",
      async run({ project }) {
        views.states(await project.states.list(), project.id);
      },
    },

    create: {
      usage: `states create --name=<text> --group=${GROUPS.join("|")} [--color=<#hex>] [--description=<text>]`,
      writes: { action: "create", what: "workflow state" },
      summary: "Create a state (its group cannot be changed later)",
      async run({ project, args }) {
        const group = args.require("group");
        if (!GROUPS.includes(group)) fail(`invalid --group '${group}'. One of: ${GROUPS.join(", ")}`);

        const created = await project.states.create({
          name: args.require("name"),
          group,
          ...args.payload({ color: "color", description: "description" }),
        });
        line(`Created state '${created.name}' [${created.group}]  ID: ${created.id}`);
        next([
          `${cmd(project.id)} states list`,
          `${cmd(project.id)} items update <item-id> --state="${created.name}"`,
        ]);
      },
    },

    update: {
      usage: "states update <state-id> [--name=<text>] [--color=<#hex>] [--description=<text>]",
      writes: { action: "update", what: "workflow state" },
      summary: "Rename or restyle a state",
      async run({ project, args }) {
        const stateId = args.at(0, "<state-id>");
        if (args.has("group")) fail("--group cannot be changed after creation (Plane API limitation).");
        const payload = args.requireSome(
          args.payload({ name: "name", color: "color", description: "description" }),
          "--name, --color and/or --description"
        );
        const updated = await project.states.update(stateId, payload);
        line(`Updated state '${updated.name}'  ID: ${updated.id}`);
      },
    },

    delete: {
      usage: "states delete <state-id>",
      writes: { action: "delete", what: "workflow state", note: "affects every work item currently in that state" },
      summary: "Delete a state",
      async run({ project, args }) {
        const stateId = args.at(0, "<state-id>");
        await project.states.remove(stateId);
        line(`Deleted state ${stateId}`);
      },
    },
  },
};
