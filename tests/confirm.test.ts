import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isGroup, type Command, type Group } from "../src/cli/dispatch.ts";
import { ROOT } from "../src/commands/index.ts";
import { acknowledge, isAcknowledged, NEEDS_CONFIRMATION } from "../src/confirm.ts";

const created: string[] = [];
const originalCwd = process.cwd();

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), "planeack-"));
  created.push(dir);
  writeFileSync(join(dir, ".planerc"), "workspace=acme\n");
  process.chdir(dir);
  return process.cwd();
}

afterEach(() => {
  process.chdir(originalCwd);
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Every leaf command in the tree, with the path used to reach it. */
function everyCommand(node: Group = ROOT, path: string[] = []): { path: string; command: Command }[] {
  const found: { path: string; command: Command }[] = [];
  for (const [name, child] of Object.entries(node.commands)) {
    if (isGroup(child)) found.push(...everyCommand(child, [...path, name]));
    else found.push({ path: [...path, name].join(" "), command: child });
  }
  return found;
}

describe("acknowledgement store", () => {
  test("remembers per project, in this directory's .plane", () => {
    const root = project();
    expect(isAcknowledged("p1")).toBe(false);

    acknowledge("p1");
    expect(isAcknowledged("p1")).toBe(true);
    expect(isAcknowledged("p2")).toBe(false);

    const stored = JSON.parse(readFileSync(join(root, ".plane", "write-ack.json"), "utf-8"));
    expect(Object.keys(stored)).toEqual(["p1"]);
  });

  test("keeps separate checkouts separate", () => {
    project();
    acknowledge("p1");
    process.chdir(originalCwd);

    project();
    expect(isAcknowledged("p1")).toBe(false);
  });

  test("survives a corrupt file rather than throwing", () => {
    const root = project();
    acknowledge("p1");
    writeFileSync(join(root, ".plane", "write-ack.json"), "{not json");
    expect(isAcknowledged("p1")).toBe(false);
  });

  test("uses an exit code distinct from an ordinary failure", () => {
    expect(NEEDS_CONFIRMATION).toBe(2);
  });
});

describe("write annotations", () => {
  const commands = everyCommand();

  /** Verbs that change something in Plane. `download` writes locally only. */
  const WRITE_VERBS = ["create", "update", "delete", "add", "remove", "set", "clear", "upload", "add-items", "remove-item"];
  const LOCAL_ONLY = ["history clear"];

  test("every command whose verb implies a change declares it", () => {
    const missing = commands
      .filter(({ path }) => WRITE_VERBS.includes(path.split(" ").pop() ?? "") && !LOCAL_ONLY.includes(path))
      .filter(({ command }) => !command.writes)
      .map(({ path }) => path);
    expect(missing).toEqual([]);
  });

  test("no read-only command claims to write", () => {
    const readOnly = ["list", "show", "activity", "images", "about", "path", "download"];
    const wrong = commands
      .filter(({ path }) => readOnly.includes(path.split(" ").pop() ?? ""))
      .filter(({ command }) => command.writes)
      .map(({ path }) => path);
    expect(wrong).toEqual([]);
  });

  test("declared effects are well formed and readable", () => {
    for (const { path, command } of commands) {
      if (!command.writes) continue;
      expect(["create", "update", "delete"]).toContain(command.writes.action);
      expect(command.writes.what.length, `${path} needs a plain-language noun`).toBeGreaterThan(2);
    }
  });

  test("the destructive commands are covered", () => {
    const byPath = new Map(commands.map((entry) => [entry.path, entry.command]));
    for (const path of ["items comment delete", "labels delete", "states delete", "cycles delete", "items update"]) {
      expect(byPath.get(path)?.writes, path).toBeDefined();
    }
    expect(byPath.get("items comment delete")?.writes?.action).toBe("delete");
    expect(byPath.get("items list")?.writes).toBeUndefined();
  });
});
