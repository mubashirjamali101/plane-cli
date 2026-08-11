import type { Command, Group } from "../cli/dispatch.ts";
import { cmd, line, next } from "../render/output.ts";
import * as views from "../render/views.ts";
import { editIdSet, type SetMode } from "./shared.ts";

/**
 * `items assignee …` keeps multiple assignees intact: `add` and `remove` amend the
 * current list, unlike `items update --assignee`, which replaces it.
 */
export const assignees: Group = {
  summary: "Assignees on a work item",
  commands: {
    list: {
      usage: "items assignee list <item-id>",
      summary: "Who the item is assigned to",
      async run({ api, project, args }) {
        const itemId = args.at(0, "<item-id>");
        const [item, names] = await Promise.all([project.items.get(itemId), api.memberNames()]);
        views.idList("assignees", item.assignees ?? [], names, [
          `${cmd(project.id)} items assignee add ${itemId} --assignee=<email>`,
          `${cmd(project.id)} items assignee remove ${itemId} --assignee=<email>`,
          `${cmd(project.id)} members list`,
        ]);
      },
    },

    add: assigneeEdit("add", "Assign more people, keeping the current assignees"),
    remove: assigneeEdit("remove", "Unassign people, keeping the others"),
    set: assigneeEdit("set", "Replace the assignees with exactly these people"),
    clear: assigneeEdit("clear", "Unassign everyone"),
  },
};

function assigneeEdit(mode: SetMode, summary: string): Command {
  return {
    usage: `items assignee ${mode} <item-id>${mode === "clear" ? "" : " --assignee=<email>[,<email>]"}`,
    writes: {
      action: "update",
      what: "assignees",
      ...(mode === "clear" ? { note: "unassigns everyone currently on the item" } : {}),
    },
    summary,
    async run({ api, project, args }) {
      const itemId = args.at(0, "<item-id>");
      const memberIds = mode === "clear" ? [] : await project.resolveMembers(args.requireList("assignee"));
      const [updated, names] = await Promise.all([
        editIdSet(project, itemId, "assignees", mode, memberIds),
        api.memberNames(),
      ]);

      const labels = updated.map((id) => names.get(id) ?? id);
      line(`Assignees now (${updated.length}): ${labels.join(", ") || "none"}`);
      next([
        `${cmd(project.id)} items assignee list ${itemId}`,
        `${cmd(project.id)} items show ${itemId}`,
      ]);
    },
  };
}
