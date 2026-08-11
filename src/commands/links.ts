import type { Group } from "../cli/dispatch.ts";
import { cmd, line, next } from "../render/output.ts";
import * as views from "../render/views.ts";

export const links: Group = {
  summary: "Links attached to a work item",
  commands: {
    list: {
      usage: "items link list <item-id>",
      summary: "List the item's links",
      async run({ project, args }) {
        const itemId = args.at(0, "<item-id>");
        views.links(await project.item(itemId).links.list(), project.id, itemId);
      },
    },

    add: {
      usage: "items link add <item-id> --url=<url> [--title=<text>]",
      writes: { action: "create", what: "link" },
      summary: "Attach a link",
      async run({ project, args }) {
        const item = project.item(args.at(0, "<item-id>"));
        const created = await item.links.create({
          url: args.require("url"),
          ...args.payload({ title: "title" }),
        });
        line(`Added link.  ID: ${created.id}`);
        next([
          `${cmd(project.id)} items link list ${item.id}`,
          `${cmd(project.id)} items link delete ${item.id} ${created.id}`,
        ]);
      },
    },

    update: {
      usage: "items link update <item-id> <link-id> [--url=<url>] [--title=<text>]",
      writes: { action: "update", what: "link" },
      summary: "Change a link's target or title",
      async run({ project, args }) {
        const item = project.item(args.at(0, "<item-id>"));
        const linkId = args.at(1, "<link-id>");
        const payload = args.requireSome(args.payload({ url: "url", title: "title" }), "--url and/or --title");
        await item.links.update(linkId, payload);
        line(`Updated link ${linkId}`);
      },
    },

    delete: {
      usage: "items link delete <item-id> <link-id>",
      writes: { action: "delete", what: "link" },
      summary: "Remove a link",
      async run({ project, args }) {
        const linkId = args.at(1, "<link-id>");
        await project.item(args.at(0, "<item-id>")).links.remove(linkId);
        line(`Deleted link ${linkId}`);
      },
    },
  },
};
