import { join } from "node:path";
import { displayPath, ensureStateDir, timestamp } from "../state.ts";

/**
 * The shared shape of everything the CLI prints.
 *
 * Every listing is a title, a run of entries, and copy-paste-ready follow-up
 * commands — so views describe *what* to show and this module decides how.
 */

const WIDTH = 78;
export const RULE = "=".repeat(WIDTH);
export const DIVIDER = "-".repeat(WIDTH);

export function line(text = ""): void {
  console.log(text);
}

export function note(text: string): void {
  process.stderr.write(`${text}\n`);
}

/** Prefix for suggested commands: `plane project=<uuid>`. */
export function cmd(projectId: string): string {
  return `plane project=${projectId}`;
}

/** A block of fully-formed commands the user can run next. */
export function next(commands: readonly string[], label = "Next"): void {
  const usable = commands.filter(Boolean);
  if (!usable.length) return;
  line(`   ${label} (copy-paste ready):`);
  for (const command of usable) line(`     ${command}`);
}

/** One rendered record: a heading, optional detail lines, optional follow-ups. */
export interface Entry {
  heading: string;
  details?: readonly (string | false | undefined)[];
  next?: readonly string[];
}

export interface ListView<T> {
  /** Plural noun for the header, e.g. `Labels`. */
  title: string;
  /** Extra header context, e.g. `on item <uuid>`. */
  subject?: string;
  /** Shown instead of the list when there is nothing, with optional suggestions. */
  empty: string;
  emptyNext?: readonly string[];
  entry(item: T, index: number): Entry;
  /** Trailing suggestion block, e.g. how to create one more. */
  footer?: { label: string; commands: readonly string[] };
}

export function printList<T>(items: readonly T[], view: ListView<T>): void {
  if (!items.length) {
    line(view.empty);
    next(view.emptyNext ?? []);
    return;
  }

  const subject = view.subject ? ` ${view.subject}` : "";
  line(`\n${RULE}`);
  line(`${view.title} (${items.length})${subject}\n`);

  items.forEach((item, index) => {
    const entry = view.entry(item, index);
    line(entry.heading);
    for (const detail of entry.details ?? []) if (detail) line(`   ${detail}`);
    next(entry.next ?? []);
    line(DIVIDER);
  });

  if (view.footer) next(view.footer.commands, view.footer.label);
}

/** A single record as aligned `Label: value` rows. */
export function printFields(fields: readonly (readonly [string, string])[]): void {
  const width = Math.max(...fields.map(([label]) => label.length)) + 1;
  for (const [label, value] of fields) line(`${(label + ":").padEnd(width + 1)} ${value}`);
}

/**
 * Print rendered text, or write it to a file when `--out` was given.
 *
 * `--out=<path>` writes exactly there; a bare `--out` writes an auto-named file into
 * this directory's `.plane/exports/`, which is where everything the CLI saves without
 * being told a location goes.
 */
export async function emit(text: string, out: string | boolean | undefined, name: string): Promise<void> {
  if (out === undefined || out === false) {
    line(text);
    return;
  }

  const path = typeof out === "string" && out ? out : join(ensureStateDir("exports"), stamped(name));

  await Bun.write(path, text.endsWith("\n") ? text : `${text}\n`);
  note(`Wrote ${displayPath(path)}`);
}

/** `items.json` -> `items-20260811-204904.json`, so exports sort by when they were made. */
function stamped(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot === -1 ? name : name.slice(0, dot);
  const extension = dot === -1 ? "" : name.slice(dot);
  return `${base}-${timestamp()}${extension}`;
}

export function toJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  return rows.map((row) => row.map(escape).join(",")).join("\n") + "\n";
}
