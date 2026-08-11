import type { ProjectApi, WorkItem } from "../api/index.ts";
import type { Args } from "../cli/args.ts";
import type { Group } from "../cli/dispatch.ts";
import { fail } from "../errors.ts";
import { toText } from "../render/html.ts";
import { cmd, emit, line, next, note, toCsv, toJson } from "../render/output.ts";
import * as views from "../render/views.ts";
import { ITEM_FIELD_FLAGS, workItemFields } from "./shared.ts";

const PRIORITY_RANK: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3, urgent: 4 };

const SORT_KEYS: Record<string, (item: WorkItem) => number> = {
  priority: (item) => PRIORITY_RANK[item.priority] ?? 0,
  created: (item) => Date.parse(item.created_at),
  updated: (item) => Date.parse(item.updated_at),
};

const CSV_HEADER = ["Title", "Priority", "State", "Description", "Created", "Updated", "ID"];

export const items: Group = {
  summary: "Work items",
  commands: {
    list: {
      usage:
        "items list [--state=<name>[,<name>]] [--priority=<name>] [--assignee=<email>] [--search=<text>]\n" +
        "[--orderby=priority|created|updated] [--sort=asc|desc] [--output=table|json|csv] [--out[=<path>]] [-v]",
      summary: "List work items, filtered and sorted",
      async run({ project, args, settings }) {
        note(`Fetching work items from project ${project.id}...`);
        const [all, stateNames] = await Promise.all([project.listItems(), project.stateNames()]);

        const matching = await filterItems(project, args, all, settings.defaultStates);
        const sorted = sortItems(matching, args);

        const output = args.str("output") ?? "table";
        const out = args.has("out") ? args.str("out") ?? true : undefined;

        if (output === "json") return emit(toJson(sorted), out, "items.json");
        if (output === "csv") return emit(toCsv([CSV_HEADER, ...sorted.map(toCsvRow)]), out, "items.csv");
        if (output !== "table") fail(`unknown --output '${output}'. Use table, json or csv.`);

        views.workItems(sorted, { projectId: project.id, states: stateNames, verbose: args.bool("verbose") });
      },
    },

    show: {
      usage: "items show <item-id> [--output=json] [--html] [--out[=<path>]]",
      summary: "Full detail for one item, including its complete description",
      async run({ api, project, args }) {
        const item = await project.items.get(args.at(0, "<item-id>"));

        const out = args.has("out") ? args.str("out") ?? true : undefined;
        if (args.str("output") === "json") return emit(toJson(item), out, `item-${item.id}.json`);
        if (args.bool("html")) return emit(item.description_html ?? "", out, `item-${item.id}.html`);

        const [states, labels, cycles, members] = await Promise.all([
          project.stateNames(),
          project.labelNames(),
          project.cycleNames(),
          api.memberNames(),
        ]);
        views.workItem(item, { states, labels, cycles, members }, project.id);
      },
    },

    create: {
      usage: `items create --title=<text> ${ITEM_FIELD_FLAGS}`,
      writes: { action: "create", what: "work item" },
      summary: "Create a work item",
      async run({ project, args }) {
        args.require("title");
        const fields = await workItemFields(project, args);
        const created = await project.items.create(fields);
        await attachCycle(project, args, created.id);

        line(`Created work item #${created.sequence_id ?? "?"}: ${created.name}`);
        line(`ID: ${created.id}`);
        next([
          `${cmd(project.id)} items show ${created.id}`,
          `${cmd(project.id)} items assignee add ${created.id} --assignee=<email>`,
          `${cmd(project.id)} items comment add ${created.id} --message="<text>"`,
        ]);
      },
    },

    update: {
      usage: `items update <item-id> [--title=<text>] ${ITEM_FIELD_FLAGS}`,
      writes: { action: "update", what: "work item" },
      summary: "Change fields on a work item (--assignee/--label replace the whole list)",
      async run({ project, args }) {
        const itemId = args.at(0, "<item-id>");
        const fields = await workItemFields(project, args);
        if (!Object.keys(fields).length && !args.has("cycle")) {
          fail(`nothing to update — provide at least one field.\nusage: ${cmd(project.id)} items update <item-id> [--title=<text>] ${ITEM_FIELD_FLAGS}`);
        }

        const updated = Object.keys(fields).length
          ? await project.items.update(itemId, fields)
          : await project.items.get(itemId);
        await attachCycle(project, args, itemId);

        line(`Updated work item: ${updated.name}`);
        line(`ID: ${updated.id}`);
        next([`${cmd(project.id)} items show ${updated.id}`]);
      },
    },

    activity: {
      usage: "items activity <item-id> [--output=json] [--out[=<path>]]",
      summary: "Change history for an item",
      async run({ api, project, args }) {
        const itemId = args.at(0, "<item-id>");
        const entries = await project.item(itemId).activity();
        if (args.str("output") === "json") {
          return emit(toJson(entries), args.has("out") ? args.str("out") ?? true : undefined, `activity-${itemId}.json`);
        }
        views.activity(entries, await api.memberNames());
      },
    },
  },
};

/** A cycle is joined through the cycle-issues endpoint, never through the item body. */
async function attachCycle(project: ProjectApi, args: Args, itemId: string): Promise<void> {
  if (!args.has("cycle")) return;
  const cycleId = await project.resolveCycle(args.require("cycle"));
  await project.cycles.addItems(cycleId, [itemId]);
}

async function filterItems(
  project: ProjectApi,
  args: Args,
  all: WorkItem[],
  defaultStates: string[]
): Promise<WorkItem[]> {
  const stateNames = args.has("state") ? args.requireList("state") : defaultStates;
  let matching = all;

  if (stateNames.length) {
    const wanted = new Set(await project.resolveStates(stateNames));
    matching = matching.filter((item) => wanted.has(item.state));
  }

  const search = (args.str("search") ?? "").toLowerCase();
  if (search) {
    matching = matching.filter((item) =>
      item.name.toLowerCase().includes(search) ||
      toText(item.description_html).toLowerCase().includes(search));
  }

  const priority = (args.str("priority") ?? "").toLowerCase();
  if (priority) matching = matching.filter((item) => (item.priority ?? "").toLowerCase() === priority);

  if (args.has("assignee")) {
    const [memberId] = await project.resolveMembers([args.require("assignee")]);
    matching = matching.filter((item) => item.assignees?.includes(memberId!));
  }

  return matching;
}

function sortItems(items: WorkItem[], args: Args): WorkItem[] {
  const orderBy = args.str("orderby") ?? "priority";
  const key = SORT_KEYS[orderBy];
  if (!key) fail(`unknown --orderby '${orderBy}'. Use ${Object.keys(SORT_KEYS).join(", ")}.`);

  const direction = args.str("sort") === "asc" ? 1 : -1;
  return [...items].sort((a, b) => direction * (key(a) - key(b)));
}

function toCsvRow(item: WorkItem): string[] {
  return [
    item.name ?? "",
    (item.priority ?? "N/A").toUpperCase(),
    item.state ?? "",
    toText(item.description_html),
    item.created_at ?? "",
    item.updated_at ?? "",
    item.id,
  ];
}
