import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSettings, requireConfig, requireProject } from "../src/config.ts";
import { CliError } from "../src/errors.ts";

const UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const created: string[] = [];
const originalCwd = process.cwd();
const originalHome = process.env.HOME;

/**
 * A throwaway directory holding a `.planerc`, made the current directory. HOME is
 * pointed at an empty directory too, so the developer's own `~/.planerc` stays out of it.
 */
function withRc(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "planerc-"));
  created.push(dir);
  writeFileSync(join(dir, ".planerc"), contents);
  process.env.HOME = mkdtempSync(join(tmpdir(), "planehome-"));
  created.push(process.env.HOME);
  process.chdir(dir);
  return dir;
}

afterEach(() => {
  process.chdir(originalCwd);
  process.env.HOME = originalHome;
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("loadSettings", () => {
  test("reads key=value lines, comments and quotes", () => {
    withRc(`# comment\napi_key = "plane_api_xyz"  # trailing\nworkspace='acme'\nbase_url=https://plane.example/api/v1/\n`);
    const settings = loadSettings({});
    expect(settings.apiKey).toBe("plane_api_xyz");
    expect(settings.workspace).toBe("acme");
    expect(settings.baseUrl).toBe("https://plane.example/api/v1");
  });

  test("accepts a bare uuid as the project", () => {
    withRc(`${UUID}\n`);
    expect(loadSettings({}).project).toBe(UUID);
  });

  test("accepts the PLANE_* spellings of every key", () => {
    withRc(`PLANE_API_KEY=k\nPLANE_WORKSPACE=w\nPLANE_BASE_URL=u\nPLANE_PROJECT=${UUID}\n`);
    const settings = loadSettings({});
    expect([settings.apiKey, settings.workspace, settings.baseUrl, settings.project]).toEqual(["k", "w", "u", UUID]);
  });

  test("the environment wins over the file, per setting", () => {
    withRc(`api_key=from-file\nworkspace=from-file\n`);
    const settings = loadSettings({ PLANE_API_KEY: "from-env" });
    expect(settings.apiKey).toBe("from-env");
    expect(settings.workspace).toBe("from-file");
    expect(settings.origins.apiKey).toBe("env");
    expect(settings.origins.workspace).toBe("rc");
    expect(settings.origins.project).toBe("none");
  });

  test("default_states is a list, and absent means every state", () => {
    withRc(`default_states=Todo, Reported Bugs\n`);
    expect(loadSettings({}).defaultStates).toEqual(["Todo", "Reported Bugs"]);
    process.chdir(originalCwd);
    withRc(`workspace=acme\n`);
    expect(loadSettings({}).defaultStates).toEqual([]);
  });
});

describe("requireConfig", () => {
  test("names every missing setting", () => {
    withRc(`workspace=acme\n`);
    expect(() => requireConfig(loadSettings({}))).toThrow(/PLANE_API_KEY, PLANE_BASE_URL/);
  });

  test("returns the config once everything is present", () => {
    withRc(`api_key=k\nworkspace=w\nbase_url=https://plane.example/api/v1\n`);
    expect(requireConfig(loadSettings({}))).toEqual({
      apiKey: "k",
      workspace: "w",
      baseUrl: "https://plane.example/api/v1",
    });
  });
});

describe("requireProject", () => {
  test("an explicit project wins over the configured default", () => {
    withRc(`project=${UUID}\n`);
    expect(requireProject(loadSettings({}), "explicit")).toBe("explicit");
    expect(requireProject(loadSettings({}))).toBe(UUID);
  });

  test("explains how to set one when there is none", () => {
    withRc(`workspace=acme\n`);
    expect(() => requireProject(loadSettings({}))).toThrow(CliError);
    expect(() => requireProject(loadSettings({}))).toThrow(/no project given/);
  });
});
