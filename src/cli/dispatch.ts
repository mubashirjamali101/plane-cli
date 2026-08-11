import type { PlaneApi, ItemApi, ProjectApi } from "../api/index.ts";
import type { Settings } from "../config.ts";
import type { WriteEffect } from "../confirm.ts";
import { fail } from "../errors.ts";
import type { Args } from "./args.ts";

/** What a command handler is given: the API, its arguments, and the target project. */
export class Context {
  private openedApi?: PlaneApi;
  private openedProject?: ProjectApi;

  constructor(
    readonly args: Args,
    readonly settings: Settings,
    private readonly openApi: () => PlaneApi,
    private readonly openProject: (api: PlaneApi) => ProjectApi
  ) {}

  /**
   * The Plane API. Built on first use, so commands that need no server — `history`,
   * `help` — work before any credentials are configured.
   */
  get api(): PlaneApi {
    return (this.openedApi ??= this.openApi());
  }

  /** The project this command acts on. Also deferred: `projects list` has none yet. */
  get project(): ProjectApi {
    return (this.openedProject ??= this.openProject(this.api));
  }

  /** The work item named by a positional argument — the first one by default. */
  item(index = 0, name = "<item-id>"): ItemApi {
    return this.project.item(this.args.at(index, name));
  }
}

export interface Command {
  /** Argument shape, without the `plane …` prefix. Shown in help and in errors. */
  usage: string;
  summary: string;
  /**
   * What this command changes in Plane. Absent means read-only, which is what
   * lets the confirmation gate tell the two apart — see src/confirm.ts.
   */
  writes?: WriteEffect;
  run(context: Context): Promise<void>;
}

export interface Group {
  summary: string;
  /** Prefix used when rendering usage lines beneath this group. Inherited if unset. */
  prefix?: string;
  /** Chosen when the next token matches no entry in `commands` — for legacy forms. */
  fallback?: Command;
  commands: Record<string, Command | Group>;
}

export function isGroup(node: Command | Group): node is Group {
  return "commands" in node;
}

export interface Resolution {
  command: Command;
  /** The tokens after the command's own verbs: its positionals and flags. */
  rest: string[];
  /** Full usage line, ready to print. */
  usage: string;
}

/** Walk the command tree, consuming verbs until a runnable command is found. */
export function resolve(root: Group, tokens: readonly string[]): Resolution {
  let node: Group = root;
  let prefix = root.prefix ?? "";
  let index = 0;

  for (;;) {
    prefix = node.prefix ?? prefix;
    const token = tokens[index];
    const child = token === undefined ? undefined : node.commands[token];

    if (!child) {
      if (node.fallback) {
        return { command: node.fallback, rest: tokens.slice(index), usage: prefix + node.fallback.usage };
      }
      const known = Object.keys(node.commands).join(" | ");
      const path = tokens.slice(0, index).join(" ");
      fail(
        token === undefined
          ? `${path || "plane"} needs a subcommand: ${known}`
          : `unknown command '${[...tokens.slice(0, index), token].join(" ")}'.\nExpected one of: ${known}`
      );
    }

    index++;
    if (!isGroup(child)) {
      return { command: child, rest: tokens.slice(index), usage: prefix + child.usage };
    }
    node = child;
  }
}

/** Every runnable command under `node`, in declaration order, with rendered usage. */
export function walk(node: Group, prefix = node.prefix ?? ""): { usage: string; summary: string }[] {
  const lines: { usage: string; summary: string }[] = [];
  const scope = node.prefix ?? prefix;
  for (const child of Object.values(node.commands)) {
    if (isGroup(child)) lines.push(...walk(child, scope));
    else lines.push({ usage: scope + child.usage, summary: child.summary });
  }
  return lines;
}
