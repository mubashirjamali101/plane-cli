import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fail } from "./errors.ts";
import { isUuid, splitList } from "./util.ts";

/** Everything the CLI needs to talk to a Plane instance. */
export interface Config {
  apiKey: string;
  workspace: string;
  baseUrl: string;
}

/** A resolved setting plus where it came from, for `--help` to report. */
export type Origin = "env" | "rc" | "none";

export interface Settings {
  apiKey?: string;
  workspace?: string;
  baseUrl?: string;
  /** Default project, used when the command omits `project=<uuid>`. */
  project?: string;
  /** Default `items list` state filter; empty means every state. */
  defaultStates: string[];
  origins: Record<"apiKey" | "workspace" | "baseUrl" | "project", Origin>;
}

interface RcValues {
  apiKey?: string;
  workspace?: string;
  baseUrl?: string;
  project?: string;
  defaultStates?: string;
}

export const RC_FILENAME = ".planerc";

/** Accepted key spellings in a `.planerc`, mapped to their setting. */
const RC_KEYS: Record<string, keyof RcValues> = {
  api_key: "apiKey",
  plane_api_key: "apiKey",
  workspace: "workspace",
  plane_workspace: "workspace",
  base_url: "baseUrl",
  plane_base_url: "baseUrl",
  project: "project",
  plane_project: "project",
  default_states: "defaultStates",
  plane_default_states: "defaultStates",
};

const ENV_KEYS = {
  apiKey: "PLANE_API_KEY",
  workspace: "PLANE_WORKSPACE",
  baseUrl: "PLANE_BASE_URL",
  project: "PLANE_PROJECT",
  defaultStates: "PLANE_DEFAULT_STATES",
} as const;

/** Parse `key=value` lines (see `RC_KEYS`) or a bare project UUID; `#` starts a comment. */
function parseRc(path: string): RcValues {
  const values: RcValues = {};
  let text: string;
  try {
    text = readFileSync(path, "utf-8");
  } catch {
    return values;
  }

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;

    const equals = line.indexOf("=");
    if (equals === -1) {
      // A bare UUID is shorthand for `project=<uuid>`.
      if (isUuid(line)) values.project ??= line;
      continue;
    }

    const key = RC_KEYS[line.slice(0, equals).trim().toLowerCase()];
    const value = line.slice(equals + 1).trim().replace(/^["']|["']$/g, "");
    if (key && value) values[key] ??= value;
  }
  return values;
}

/** The nearest `.planerc` walking up from the current directory. */
function findLocalRc(startDir: string = process.cwd()): string | undefined {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, RC_FILENAME);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** The directory holding the nearest `.planerc`, which anchors per-project state. */
export function localRcDir(): string | undefined {
  const path = findLocalRc();
  return path ? dirname(path) : undefined;
}

/** `~/.planerc`, honouring an overridden HOME so it can be pointed elsewhere. */
export function globalRcPath(): string {
  return join(process.env.HOME || process.env.USERPROFILE || homedir(), RC_FILENAME);
}

/**
 * Resolve every setting independently, so credentials can live in `~/.planerc`
 * while a repository's own `.planerc` only pins the project.
 *
 * Precedence per setting: environment variable > nearest `.planerc` > `~/.planerc`.
 */
export function loadSettings(env: NodeJS.ProcessEnv = process.env): Settings {
  const localPath = findLocalRc();
  const local = localPath ? parseRc(localPath) : {};
  const global = parseRc(globalRcPath());
  const rc: RcValues = { ...global, ...local };

  const origins = {} as Settings["origins"];
  const resolve = (key: keyof typeof ENV_KEYS): string | undefined => {
    const fromEnv = env[ENV_KEYS[key]];
    const value = fromEnv || rc[key];
    if (key !== "defaultStates") {
      origins[key] = fromEnv ? "env" : rc[key] ? "rc" : "none";
    }
    return value || undefined;
  };

  return {
    apiKey: resolve("apiKey"),
    workspace: resolve("workspace"),
    baseUrl: resolve("baseUrl")?.replace(/\/+$/, ""),
    project: resolve("project"),
    defaultStates: splitList(resolve("defaultStates")),
    origins,
  };
}

/** Narrow settings to a usable `Config`, or explain exactly what is missing. */
export function requireConfig(settings: Settings): Config {
  const missing = (["apiKey", "workspace", "baseUrl"] as const).filter((key) => !settings[key]);
  if (missing.length) {
    fail(
      `missing required setting(s): ${missing.map((key) => ENV_KEYS[key]).join(", ")}\n` +
        `Set them as environment variables, or in ${RC_FILENAME} / ${globalRcPath()}:\n` +
        `  api_key=plane_api_...\n` +
        `  workspace=your-workspace\n` +
        `  base_url=https://your-plane-instance.example/api/v1\n` +
        `Run 'plane --help' for details.`
    );
  }
  return {
    apiKey: settings.apiKey!,
    workspace: settings.workspace!,
    baseUrl: settings.baseUrl!,
  };
}

/** The project to act on: an explicit `project=<uuid>` wins over the configured default. */
export function requireProject(settings: Settings, explicit?: string): string {
  if (explicit) return explicit;
  if (settings.project) return settings.project;
  fail(
    `no project given and no default configured.\n` +
      `Either name it on the command line:\n` +
      `  plane project=<uuid> items list\n` +
      `or set a default (project UUIDs come from 'plane projects list'):\n` +
      `  echo "project=<uuid>" > ${RC_FILENAME}      # this directory tree\n` +
      `  echo "project=<uuid>" > ${globalRcPath()}   # everywhere`
  );
}

/**
 * Write a starter `~/.planerc` the first time the CLI runs, pre-filled with whatever
 * settings it was given so the next invocation needs no environment at all. Settings
 * that are still unknown are written as commented examples. Never overwrites.
 */
export function initGlobalRc(known: { apiKey?: string; workspace?: string; baseUrl?: string; project?: string }): void {
  const path = globalRcPath();
  if (existsSync(path)) return;

  const setting = (key: string, value: string | undefined, example: string) =>
    value ? `${key}=${value}` : `# ${key}=${example}`;

  const content = [
    "# plane CLI configuration — created automatically on first run.",
    `# Precedence per setting: environment variable > nearest ${RC_FILENAME} > this file.`,
    "",
    setting("api_key", known.apiKey, "plane_api_..."),
    setting("workspace", known.workspace, "your-workspace"),
    setting("base_url", known.baseUrl, "https://your-plane-instance.example/api/v1"),
    setting("project", known.project, "<uuid>   # default project, from 'plane projects list'"),
    "",
    "# Restrict the default 'items list' view to certain states (comma separated).",
    "# default_states=Todo,In Progress",
    "",
  ].join("\n");

  try {
    writeFileSync(path, content, { mode: 0o600 });
    process.stderr.write(`Note: created ${path} with your current settings. Edit it to change defaults.\n`);
  } catch {
    // A convenience file that cannot be written must never break the command.
  }
}
