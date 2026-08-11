import type { Group } from "../cli/dispatch.ts";
import { fail } from "../errors.ts";
import { cmd, line, next, note } from "../render/output.ts";
import { displayPath, ensureStateDir } from "../state.ts";
import * as views from "../render/views.ts";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  zip: "application/zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function contentTypeOf(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

export const attachments: Group = {
  summary: "Files attached to a work item",
  commands: {
    list: {
      usage: "items attachment list <item-id>",
      summary: "List attachments",
      async run({ project, args }) {
        const itemId = args.at(0, "<item-id>");
        views.attachments(await project.item(itemId).attachments.list(), project.id, itemId);
      },
    },

    upload: {
      usage: "items attachment upload <item-id> --file=<path>",
      writes: { action: "create", what: "attachment" },
      summary: "Upload a file to the item",
      async run({ project, args }) {
        const item = project.item(args.at(0, "<item-id>"));
        const path = args.require("file");

        const file = Bun.file(path);
        if (!(await file.exists())) fail(`file not found: ${path}`);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const filename = path.split("/").pop() || path;

        note("Requesting upload credentials...");
        const assetId = await item.upload(bytes, filename, contentTypeOf(filename));

        line(`Uploaded '${filename}' (${bytes.length} bytes).  Attachment ID: ${assetId}`);
        next([
          `${cmd(project.id)} items attachment list ${item.id}`,
          `${cmd(project.id)} items attachment download ${item.id} ${assetId}`,
        ]);
      },
    },

    download: {
      usage: "items attachment download <item-id> <attachment-id> [--out=<path>]",
      summary: "Download an attachment (named after the stored file by default)",
      async run({ project, args }) {
        const item = project.item(args.at(0, "<item-id>"));
        const attachmentId = args.at(1, "<attachment-id>");

        const known = (await item.attachments.list()).find((entry) => entry.id === attachmentId);
        const filename = known?.attributes?.name ?? attachmentId;
        // Without an explicit --out, save into this directory's .plane/ like every other
        // file the CLI writes, rather than into whatever directory you happen to be in.
        const path = args.str("out") ?? `${ensureStateDir("attachments")}/${filename}`;

        const { bytes } = await item.fetchAsset(item.assetUrl(attachmentId));
        await Bun.write(path, bytes);
        line(`Downloaded to ${displayPath(path)} (${bytes.length} bytes)`);
      },
    },

    delete: {
      usage: "items attachment delete <item-id> <attachment-id>",
      writes: { action: "delete", what: "attachment" },
      summary: "Delete an attachment",
      async run({ project, args }) {
        const attachmentId = args.at(1, "<attachment-id>");
        await project.item(args.at(0, "<item-id>")).attachments.remove(attachmentId);
        line(`Deleted attachment ${attachmentId}`);
      },
    },
  },
};
