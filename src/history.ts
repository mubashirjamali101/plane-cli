import { appendFileSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { ensureStateDir, statePath } from "./state.ts";

/** One recorded invocation. */
export interface HistoryEntry {
  /** ISO timestamp of when the command finished. */
  at: string;
  /** The arguments as typed, minus anything that looked like a secret. */
  argv: string[];
  project?: string;
  status: "ok" | "error";
  /** The error message, when the command failed. */
  error?: string;
  /** Wall-clock duration in milliseconds. */
  ms: number;
}

/** Entries kept per directory; the file is trimmed to this on the next write. */
const MAX_ENTRIES = 500;
const TRIM_AT_BYTES = 512 * 1024;

const SECRET = /^(plane_api_\S+|--(?:api[-_]?key|token|password)=.*)$/i;

export function historyPath(): string {
  return statePath("history.jsonl");
}

/** Drop anything that looks like a credential, so history is safe to read and share. */
function redact(argv: readonly string[]): string[] {
  return argv.map((token) => (SECRET.test(token) ? "<redacted>" : token));
}

/**
 * Append an entry to this directory's history.
 *
 * Recording is best-effort: a read-only or full disk must never turn a command that
 * already succeeded into a failure.
 */
export function record(entry: Omit<HistoryEntry, "argv"> & { argv: readonly string[] }): void {
  try {
    ensureStateDir();
    const path = historyPath();
    trimIfLarge(path);
    appendFileSync(path, JSON.stringify({ ...entry, argv: redact(entry.argv) }) + "\n");
  } catch {
    // Ignored on purpose.
  }
}

/** The most recent entries, oldest first. */
export function read(limit = MAX_ENTRIES): HistoryEntry[] {
  let text: string;
  try {
    text = readFileSync(historyPath(), "utf-8");
  } catch {
    return [];
  }

  const entries: HistoryEntry[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as HistoryEntry);
    } catch {
      // A truncated final line (interrupted write) is skipped rather than fatal.
    }
  }
  return entries.slice(-limit);
}

export function clear(): void {
  rmSync(historyPath(), { force: true });
}

/** Keep the file bounded by rewriting it with only the most recent entries. */
function trimIfLarge(path: string): void {
  try {
    if (statSync(path).size < TRIM_AT_BYTES) return;
  } catch {
    return; // No file yet.
  }
  const kept = read(MAX_ENTRIES).map((entry) => JSON.stringify(entry) + "\n").join("");
  writeFileSync(path, kept);
}
