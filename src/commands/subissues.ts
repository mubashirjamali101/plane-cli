import type { ProjectApi } from "../api/index.ts";
import type { Group } from "../cli/dispatch.ts";
import { cmd, line, next } from "../render/output.ts";
import * as views from "../render/views.ts";
import { ITEM_FIELD_FLAGS, workItemFields } from "./shared.ts";

/** Parent/child links. Plane models them as a `parent` field on the child item. */
export const subissues: Group = {
  summary: "Sub-issues of a work item",
  commands: {
    list: {
      usage: "items subissue list <parent-id>",
      summary: "List the item's children",
      async run({ project, args }) {
        const parentId = args.at(0, "<parent-id>");
        const [all, states] = await Promise.all([project.listItems(), project.stateNames()]);
        views.subIssues(all.filter((item) => item.parent === parentId), states, project.id, parentId);
      },
    },

    create: {
      usage: `items subissue create <parent-id> --title=<text> ${ITEM_FIELD_FLAGS}`,
      writes: { action: "create", what: "sub-issue" },
      summary: "Create a new item as a child of this one",
      async run({ project, args }) {
        const parentId = args.at(0, "<parent-id>");
        args.require("title");
        const created = await project.items.create({
          ...(await workItemFields(project, args)),
          parent: parentId,
        });

        line(`Created sub-issue #${created.sequence_id ?? "?"}: ${created.name}`);
        line(`ID: ${created.id}`);
        next([
          `${cmd(project.id)} items show ${created.id}`,
          `${cmd(project.id)} items subissue list ${parentId}`,
        ]);
      },
    },

    add: {
      usage: "items subissue add <parent-id> --child=<item-id>[,<item-id>]",
      writes: { action: "update", what: "parent/child links" },
      summary: "Adopt existing items as children",
      async run({ project, args }) {
        await reparent(project, args.at(0, "<parent-id>"), args.requireList("child"), true);
      },
    },

    remove: {
      usage: "items subissue remove <parent-id> --child=<item-id>[,<item-id>]",
      writes: { action: "update", what: "parent/child links" },
      summary: "Detach children, leaving the items themselves alone",
      async run({ project, args }) {
        await reparent(project, args.at(0, "<parent-id>"), args.requireList("child"), false);
      },
    },
  },
};

async function reparent(
  project: ProjectApi,
  parentId: string,
  children: string[],
  attach: boolean
): Promise<void> {
  for (const childId of children) {
    await project.items.update(childId, { parent: attach ? parentId : null });
    line(`${attach ? "Linked" : "Unlinked"} ${childId}`);
  }
  next([`${cmd(project.id)} items subissue list ${parentId}`]);
}
