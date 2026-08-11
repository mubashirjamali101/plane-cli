import type { Command, Group } from "../cli/dispatch.ts";
import { cmd, line, next } from "../render/output.ts";
import * as views from "../render/views.ts";
import { editIdSet, type SetMode } from "./shared.ts";

export const labels: Group = {
  summary: "Labels defined on the project",
  commands: {
    list: {
      usage: "labels list",
      summary: "List the project's labels",
      async run({ project }) {
        views.labels(await project.labels.list(), project.id);
      },
    },

    create: {
      usage: "labels create --name=<text> [--color=<#hex>] [--description=<text>]",
      writes: { action: "create", what: "label" },
      summary: "Create a label",
      async run({ project, args }) {
        const created = await project.labels.create({
          name: args.require("name"),
          ...args.payload({ color: "color", description: "description" }),
        });
        line(`Created label '${created.name}'  ID: ${created.id}`);
        next([
          `${cmd(project.id)} labels list`,
          `${cmd(project.id)} items label add <item-id> --label="${created.name}"`,
        ]);
      },
    },

    update: {
      usage: "labels update <label-id> [--name=<text>] [--color=<#hex>] [--description=<text>]",
      writes: { action: "update", what: "label" },
      summary: "Rename or restyle a label",
      async run({ project, args }) {
        const labelId = args.at(0, "<label-id>");
        const payload = args.requireSome(
          args.payload({ name: "name", color: "color", description: "description" }),
          "--name, --color and/or --description"
        );
        const updated = await project.labels.update(labelId, payload);
        line(`Updated label '${updated.name}'  ID: ${updated.id}`);
      },
    },

    delete: {
      usage: "labels delete <label-id>",
      writes: { action: "delete", what: "label", note: "removes it from every item that uses it" },
      summary: "Delete a label from the project",
      async run({ project, args }) {
        const labelId = args.at(0, "<label-id>");
        await project.labels.remove(labelId);
        line(`Deleted label ${labelId}`);
      },
    },
  },
};

/** `items label …` — which labels are attached to one work item. */
export const itemLabels: Group = {
  summary: "Labels attached to a work item",
  commands: {
    list: {
      usage: "items label list <item-id>",
      summary: "Labels currently on the item",
      async run({ project, args }) {
        const itemId = args.at(0, "<item-id>");
        const [item, names] = await Promise.all([project.items.get(itemId), project.labelNames()]);
        views.idList("labels", item.labels ?? [], names, [
          `${cmd(project.id)} items label add ${itemId} --label=<name>`,
          `${cmd(project.id)} items label remove ${itemId} --label=<name>`,
          `${cmd(project.id)} labels list`,
        ]);
      },
    },

    add: labelEdit("add", "Attach labels, keeping the existing ones"),
    remove: labelEdit("remove", "Detach labels, keeping the others"),
    set: labelEdit("set", "Replace the item's labels with exactly these"),
    clear: labelEdit("clear", "Remove every label from the item"),
  },
};

function labelEdit(mode: SetMode, summary: string): Command {
  return {
    usage: `items label ${mode} <item-id>${mode === "clear" ? "" : " --label=<name>[,<name>]"}`,
    writes: {
      action: "update",
      what: "labels",
      ...(mode === "clear" ? { note: "removes every label currently on the item" } : {}),
    },
    summary,
    async run({ project, args }) {
      const itemId = args.at(0, "<item-id>");
      const labelIds = mode === "clear" ? [] : await project.resolveLabels(args.requireList("label"));
      const [updated, names] = await Promise.all([
        editIdSet(project, itemId, "labels", mode, labelIds),
        project.labelNames(),
      ]);

      const labelNames = updated.map((id) => names.get(id) ?? id);
      line(`Labels now (${updated.length}): ${labelNames.join(", ") || "none"}`);
      next([
        `${cmd(project.id)} items label list ${itemId}`,
        `${cmd(project.id)} items show ${itemId}`,
      ]);
    },
  };
}
