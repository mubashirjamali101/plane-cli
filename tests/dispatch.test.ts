import { describe, expect, test } from "bun:test";
import { resolve, walk } from "../src/cli/dispatch.ts";
import { ROOT } from "../src/commands/index.ts";
import { CliError } from "../src/errors.ts";

describe("resolve", () => {
  test("walks nested groups and returns the remaining tokens", () => {
    const { command, rest, usage } = resolve(ROOT, ["items", "comment", "add", "ID", "--message=hi"]);
    expect(command.usage).toStartWith("items comment add");
    expect(rest).toEqual(["ID", "--message=hi"]);
    expect(usage).toStartWith("plane project=<uuid> items comment add");
  });

  test("workspace commands keep the plain prefix", () => {
    expect(resolve(ROOT, ["projects", "list"]).usage).toBe("plane projects list [--search=<text>]");
  });

  test("falls back to the legacy 'items comment <item-id>' form", () => {
    const { command, rest } = resolve(ROOT, ["items", "comment", "ID", "--message=hi"]);
    expect(command.usage).toBe("items comment <item-id> --message=<text>");
    expect(rest).toEqual(["ID", "--message=hi"]);
  });

  test("names the alternatives for an unknown command", () => {
    expect(() => resolve(ROOT, ["bogus"])).toThrow(CliError);
    expect(() => resolve(ROOT, ["items", "bogus"])).toThrow(/unknown command 'items bogus'/);
    expect(() => resolve(ROOT, ["labels"])).toThrow(/needs a subcommand: list \| create \| update \| delete/);
  });
});

describe("walk", () => {
  const commands = walk(ROOT);

  test("reaches every leaf command", () => {
    expect(commands.length).toBeGreaterThan(40);
  });

  test("every command documents itself", () => {
    for (const { usage, summary } of commands) {
      expect(usage).toStartWith("plane ");
      expect(summary.length).toBeGreaterThan(0);
    }
  });

  test("project-scoped commands are shown with project=<uuid>", () => {
    const list = commands.find((entry) => entry.usage.includes("items list"));
    expect(list?.usage).toStartWith("plane project=<uuid> ");
  });
});
