import type { Command } from "../cli/dispatch.ts";
import { fail } from "../errors.ts";
import { embeddedImages } from "../render/html.ts";
import { cmd, line, next } from "../render/output.ts";
import { displayPath, statePath } from "../state.ts";

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

/**
 * Images embedded in an item's description — the ones the web editor stores as
 * `<image-component src="<asset-uuid>">`, which no plain HTTP client can fetch
 * without the API key. A ticket whose body is only a screenshot looks empty
 * everywhere else in the CLI, so this is how you read it.
 */
export const images: Command = {
  usage: "items images <item-id> [--download[=<dir>]]",
  summary: "List (and optionally download) images embedded in the description",
  async run({ project, args }) {
    const itemId = args.at(0, "<item-id>");
    const item = project.item(itemId);
    const found = embeddedImages((await project.items.get(itemId)).description_html);

    if (!found.length) {
      line("No images found in the description.");
      return;
    }

    const urls = found.map((image) =>
      image.kind === "asset" ? item.assetUrl(image.value) : absoluteUrl(image.value, item.origin));

    const assetCount = found.filter((image) => image.kind === "asset").length;
    const detail = assetCount ? ` (${assetCount} Plane asset(s), fetched with your API key)` : "";
    line(`Found ${urls.length} image(s) in the description${detail}:\n`);
    urls.forEach((url, index) => line(`${index + 1}. ${url}`));

    if (!args.has("download")) {
      next([
        `${cmd(project.id)} items images ${itemId} --download`,
        `${cmd(project.id)} items images ${itemId} --download=<dir>`,
        `${cmd(project.id)} items show ${itemId}`,
      ]);
      return;
    }

    // A bare --download saves into this directory's .plane/, beside the .planerc that
    // configured the run; --download=<dir> is taken literally.
    const directory = args.str("download") ?? statePath("images", itemId);
    line(`\nDownloading to ${displayPath(directory)}/ ...`);

    let saved = 0;
    for (const [index, url] of urls.entries()) {
      try {
        const { bytes, contentType } = await item.fetchAsset(url);
        const path = `${directory}/image-${index + 1}.${extensionFor(contentType, url)}`;
        await Bun.write(path, bytes);
        line(`  Saved ${displayPath(path)} (${bytes.length} bytes)`);
        saved++;
      } catch (error) {
        line(`  Failed image ${index + 1}: ${(error as Error).message}`);
      }
    }

    // Exit non-zero on total failure, so a script cannot read "downloaded" from a clean exit.
    if (!saved) fail(`downloaded 0 of ${urls.length} image(s).`);
  },
};

/** Resolve a plain `src` against the Plane instance when it is site-relative. */
function absoluteUrl(src: string, origin: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  return origin + (src.startsWith("/") ? src : `/${src}`);
}

/** Name the file from what the server actually sent, falling back to the URL. */
function extensionFor(contentType: string, url: string): string {
  const fromType = EXTENSIONS[contentType.split(";")[0]!.trim().toLowerCase()];
  if (fromType) return fromType;
  return url.split("?")[0]!.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? "png";
}
