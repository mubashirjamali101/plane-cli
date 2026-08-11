import { isUuid } from "../util.ts";

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** Render description/comment HTML as readable plain text. */
export function toText(html: string | undefined, maxLength?: number): string {
  if (!html) return "";
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return maxLength === undefined ? text : text.slice(0, maxLength);
}

/** An image referenced by a description body. */
export interface EmbeddedImage {
  /** `asset` is a Plane asset uuid served behind auth; `url` is an ordinary src. */
  kind: "asset" | "url";
  /** The asset uuid, or the raw src for a `url` image. */
  value: string;
}

const IMAGE_TAG = /<(?:img|image-component)\b[^>]*?\ssrc=["']([^"']+)["']/gi;

/**
 * Every image in a description body, in document order.
 *
 * Plane's editor stores pasted screenshots as `<image-component src="<asset-uuid>">`
 * rather than `<img>`, so scanning for `<img>` alone reports "no images" on exactly the
 * tickets whose entire content is a screenshot. Both forms are read here.
 */
export function embeddedImages(html: string | undefined): EmbeddedImage[] {
  if (!html) return [];
  return [...html.matchAll(IMAGE_TAG)].map(([, src]) => ({
    kind: isUuid(src!) ? "asset" : "url",
    value: src!,
  }));
}
