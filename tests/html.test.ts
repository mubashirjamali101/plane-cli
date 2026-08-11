import { describe, expect, test } from "bun:test";
import { embeddedImages, toText } from "../src/render/html.ts";

describe("toText", () => {
  test("turns block tags into line breaks and bullets", () => {
    expect(toText("<p>one</p><ul><li>a</li><li>b</li></ul>")).toBe("one\n• a\n• b");
  });

  test("decodes the entities Plane emits", () => {
    expect(toText("<p>a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39;&nbsp;f</p>")).toBe(`a & b <c> "d" 'e' f`);
  });

  test("collapses runs of blank lines and trims", () => {
    expect(toText("<p>a</p><p></p><p></p><p></p><p>b</p>")).toBe("a\n\nb");
  });

  test("truncates only when asked", () => {
    expect(toText("<p>abcdef</p>")).toBe("abcdef");
    expect(toText("<p>abcdef</p>", 3)).toBe("abc");
  });

  test("is safe on empty input", () => {
    expect(toText(undefined)).toBe("");
    expect(toText("")).toBe("");
  });
});

describe("embeddedImages", () => {
  const asset = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  test("finds the <image-component> form the editor writes for pasted screenshots", () => {
    expect(embeddedImages(`<image-component src="${asset}" width="35%"></image-component>`))
      .toEqual([{ kind: "asset", value: asset }]);
  });

  test("finds ordinary <img> tags", () => {
    expect(embeddedImages(`<img alt="x" src="https://example.com/a.png">`))
      .toEqual([{ kind: "url", value: "https://example.com/a.png" }]);
  });

  test("returns every image in document order", () => {
    const html = `<img src="/one.png"><p>text</p><image-component src="${asset}">`;
    expect(embeddedImages(html)).toEqual([
      { kind: "url", value: "/one.png" },
      { kind: "asset", value: asset },
    ]);
  });

  test("returns nothing for a body without images", () => {
    expect(embeddedImages("<p>plain</p>")).toEqual([]);
    expect(embeddedImages(undefined)).toEqual([]);
  });
});
