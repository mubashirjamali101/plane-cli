import type { Args } from "../cli/args.ts";
import type { Command, Context, Group } from "../cli/dispatch.ts";
import { cmd, line, next } from "../render/output.ts";
import * as views from "../render/views.ts";

/** `--message` is plain text and gets wrapped; `--message-html` is passed through. */
function body(args: Args): string {
  if (args.has("message-html")) return args.require("message-html");
  return `<p>${args.require("message")}</p>`;
}

async function post(context: Context, itemId: string): Promise<void> {
  const { project, args } = context;
  const created = await project.item(itemId).comments.create({ comment_html: body(args) });

  line(`Comment posted. ID: ${created.id}`);
  next([
    `${cmd(project.id)} items comment list ${itemId}`,
    `${cmd(project.id)} items comment update ${itemId} ${created.id} --message="<text>"`,
    `${cmd(project.id)} items comment delete ${itemId} ${created.id}`,
  ]);
}

const add: Command = {
  usage: "items comment add <item-id> --message=<text>|--message-html=<html>",
  writes: { action: "create", what: "comment" },
  summary: "Post a comment",
  run: (context) => post(context, context.args.at(0, "<item-id>")),
};

export const comments: Group = {
  summary: "Comments on a work item",
  // `items comment <item-id> --message=...` predates the subcommands and still works.
  fallback: { ...add, usage: "items comment <item-id> --message=<text>" },
  commands: {
    list: {
      usage: "items comment list <item-id>",
      summary: "Read the comment thread",
      async run({ api, project, args }) {
        const itemId = args.at(0, "<item-id>");
        const [thread, members] = await Promise.all([
          project.item(itemId).comments.list(),
          api.memberNames(),
        ]);
        views.comments(thread, members, project.id, itemId);
      },
    },

    add,

    update: {
      usage: "items comment update <item-id> <comment-id> --message=<text>|--message-html=<html>",
      writes: { action: "update", what: "comment" },
      summary: "Rewrite a comment",
      async run({ project, args }) {
        const item = project.item(args.at(0, "<item-id>"));
        const commentId = args.at(1, "<comment-id>");
        await item.comments.update(commentId, { comment_html: body(args) });
        line(`Updated comment ${commentId}`);
        next([`${cmd(project.id)} items comment list ${item.id}`]);
      },
    },

    delete: {
      usage: "items comment delete <item-id> <comment-id>",
      writes: { action: "delete", what: "comment" },
      summary: "Delete a comment",
      async run({ project, args }) {
        const commentId = args.at(1, "<comment-id>");
        await project.item(args.at(0, "<item-id>")).comments.remove(commentId);
        line(`Deleted comment ${commentId}`);
      },
    },
  },
};
