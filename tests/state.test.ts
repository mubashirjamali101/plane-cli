import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clear, historyPath, read, record } from "../src/history.ts";
import { displayPath, ensureStateDir, stateRoot, statePath, timestamp } from "../src/state.ts";

const created: string[] = [];
const originalCwd = process.cwd();

/**
 * A throwaway project directory with a `.planerc`, made the current directory.
 * Returns the resolved path, since macOS reports /var as /private/var.
 */
function project(): string {
  const dir = mkdtempSync(join(tmpdir(), "planestate-"));
  created.push(dir);
  writeFileSync(join(dir, ".planerc"), "workspace=acme\n");
  process.chdir(dir);
  return process.cwd();
}

afterEach(() => {
  process.chdir(originalCwd);
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("stateRoot", () => {
  test("anchors on the directory holding .planerc, not the current one", () => {
    const root = project();
    const nested = join(root, "src", "deep");
    mkdirSync(nested, { recursive: true });
    process.chdir(nested);

    expect(stateRoot()).toBe(root);
    expect(statePath("images", "abc")).toBe(join(root, ".plane", "images", "abc"));
  });

  test("falls back to the current directory when there is no .planerc", () => {
    const dir = mkdtempSync(join(tmpdir(), "planebare-"));
    created.push(dir);
    process.chdir(dir);
    expect(stateRoot()).toBe(process.cwd());
  });
});

describe("ensureStateDir", () => {
  test("creates the directory and returns it", () => {
    const root = project();
    const path = ensureStateDir("exports");
    expect(path).toBe(join(root, ".plane", "exports"));
    expect(existsSync(path)).toBe(true);
  });
});

describe("displayPath", () => {
  test("shortens paths under the current directory", () => {
    const root = project();
    expect(displayPath(join(root, ".plane", "images"))).toBe(".plane/images");
  });

  test("leaves unrelated paths absolute", () => {
    project();
    expect(displayPath("/etc/hosts")).toBe("/etc/hosts");
  });
});

describe("timestamp", () => {
  test("is filesystem safe and sortable", () => {
    expect(timestamp(new Date(2026, 7, 11, 20, 41, 55))).toBe("20260811-204155");
  });
});

describe("history", () => {
  const entry = (argv: string[], status: "ok" | "error" = "ok") => ({
    at: "2026-08-11T20:41:55.000Z",
    argv,
    project: "p1",
    status,
    ms: 12,
  });

  test("records into the project's own .plane directory", () => {
    const root = project();
    record(entry(["items", "list"]));

    expect(historyPath()).toBe(join(root, ".plane", "history.jsonl"));
    expect(read()).toHaveLength(1);
    expect(read()[0]?.argv).toEqual(["items", "list"]);
  });

  test("keeps each directory's history separate", () => {
    project();
    record(entry(["items", "list"]));
    process.chdir(originalCwd);

    project();
    expect(read()).toEqual([]);
  });

  test("redacts anything that looks like a credential", () => {
    project();
    record(entry(["items", "list", "plane_api_secret", "--api-key=secret"]));

    const stored = readFileSync(historyPath(), "utf-8");
    expect(stored).not.toContain("secret");
    expect(read()[0]?.argv).toEqual(["items", "list", "<redacted>", "<redacted>"]);
  });

  test("returns the most recent entries, oldest first", () => {
    project();
    for (let i = 0; i < 5; i++) record(entry(["items", "show", String(i)]));

    const recent = read(2);
    expect(recent.map((item) => item.argv[2])).toEqual(["3", "4"]);
  });

  test("skips a truncated line rather than failing", () => {
    project();
    record(entry(["items", "list"]));
    writeFileSync(historyPath(), readFileSync(historyPath(), "utf-8") + '{"at":"broken', { flag: "w" });
    expect(read()).toHaveLength(1);
  });

  test("clear() forgets everything", () => {
    project();
    record(entry(["items", "list"]));
    clear();
    expect(read()).toEqual([]);
  });

  test("recording never throws, even with nowhere to write", () => {
    const dir = mkdtempSync(join(tmpdir(), "planero-"));
    created.push(dir);
    // A file where `.plane/` must be a directory makes ensureStateDir fail on every OS.
    // (Deleting the cwd works on Unix but fails with EBUSY on Windows.)
    writeFileSync(join(dir, ".plane"), "not a directory");
    process.chdir(dir);
    expect(() => record(entry(["items", "list"]))).not.toThrow();
  });
});
