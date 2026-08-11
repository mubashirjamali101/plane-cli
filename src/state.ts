import { mkdirSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { localRcDir } from "./config.ts";

/**
 * Per-directory working state: downloads, exports and command history.
 *
 * Everything the CLI writes without being told where lands in a `.plane/` directory
 * beside the `.planerc` that configured the run — so a checkout's tickets, screenshots
 * and history stay with that checkout instead of piling up in whatever directory you
 * happened to be in. Without a `.planerc`, the current directory is used.
 */
export const STATE_DIR = ".plane";

/** The directory `.plane/` belongs to: the nearest `.planerc`'s directory, else cwd. */
export function stateRoot(): string {
  return localRcDir() ?? process.cwd();
}

/** A path inside the state directory, e.g. `statePath("images", itemId)`. */
export function statePath(...segments: string[]): string {
  return join(stateRoot(), STATE_DIR, ...segments);
}

/** Create a state subdirectory if it does not exist yet. */
export function ensureStateDir(...segments: string[]): string {
  const path = statePath(...segments);
  mkdirSync(path, { recursive: true });
  return path;
}

/** Shorten a path for display: relative to the current directory when that is shorter. */
export function displayPath(path: string): string {
  const fromHere = relative(process.cwd(), path);
  if (!fromHere || fromHere.startsWith("..") || isAbsolute(fromHere)) return path;
  return fromHere;
}

/** A filesystem-safe stamp for auto-named export files: `20260811-204155`. */
export function timestamp(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}
