import { describe, expect, test } from "bun:test";
import { Args } from "../src/cli/args.ts";
import { CliError } from "../src/errors.ts";

const parse = (line: string) => Args.parse(line.split(" ").filter(Boolean), "plane test <id>");

describe("Args.parse", () => {
  test("reads positionals before flags", () => {
    expect(parse("abc def --title=x").positionals).toEqual(["abc", "def"]);
  });

  test("accepts --flag=value and --flag value", () => {
    const args = parse("--title=one --priority high");
    expect(args.str("title")).toBe("one");
    expect(args.str("priority")).toBe("high");
  });

  test("treats a trailing --flag as a boolean", () => {
    const args = parse("id --download");
    expect(args.has("download")).toBe(true);
    expect(args.bool("download")).toBe(true);
    expect(args.str("download")).toBeUndefined();
  });

  test("a flag followed by another flag stays boolean", () => {
    const args = parse("--html --output=json");
    expect(args.bool("html")).toBe(true);
    expect(args.str("output")).toBe("json");
  });

  test("-v is an alias for --verbose", () => {
    expect(parse("-v").bool("verbose")).toBe(true);
  });

  test("keeps a value that itself contains '='", () => {
    expect(parse("--url=https://x/y?a=b").str("url")).toBe("https://x/y?a=b");
  });

  test("does not collect positionals that follow a flag", () => {
    expect(parse("--title=x stray").positionals).toEqual([]);
  });

  test("--flag= clears a field, and is distinguishable from an absent flag", () => {
    const args = parse("--description=");
    expect(args.has("description")).toBe(true);
    expect(args.str("description")).toBe("");
    expect(args.payload({ description: "description" })).toEqual({ description: "" });
  });
});

describe("Args accessors", () => {
  test("at() reports the missing positional with the usage line", () => {
    expect(() => parse("").at(0, "<item-id>")).toThrow(CliError);
    expect(() => parse("").at(0, "<item-id>")).toThrow(/missing <item-id>[\s\S]*usage: plane test <id>/);
  });

  test("require() rejects a missing or empty flag", () => {
    expect(() => parse("").require("title")).toThrow(/--title is required/);
    expect(() => parse("--title=").require("title")).toThrow(/--title is required/);
  });

  test("requireList() splits and trims", () => {
    const args = Args.parse(["--assignee=a@x.com, b@x.com ,,"], "usage");
    expect(args.requireList("assignee")).toEqual(["a@x.com", "b@x.com"]);
    expect(() => parse("").requireList("assignee")).toThrow(/--assignee=<value>/);
  });

  test("payload() maps only the flags that were passed", () => {
    expect(parse("--name=n --color=#fff").payload({ name: "name", color: "color", description: "description" }))
      .toEqual({ name: "n", color: "#fff" });
  });

  test("requireSome() rejects an empty payload", () => {
    expect(() => parse("").requireSome({}, "--name")).toThrow(/nothing to update/);
    expect(parse("").requireSome({ name: "n" }, "--name")).toEqual({ name: "n" });
  });

  test("minutes() parses durations", () => {
    expect(parse("--duration=1h30m").minutes("duration")).toBe(90);
    expect(parse("").minutes("duration")).toBeUndefined();
  });
});
