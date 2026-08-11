import { fail } from "./errors.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Split a comma-separated value into trimmed, non-empty entries. */
export function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

/** Parse a duration like `90`, `1h30m`, `2h` or `45m` into whole minutes. */
export function parseDuration(value: string): number {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);

  let total = 0;
  let matched = false;
  for (const match of trimmed.matchAll(/(\d+)\s*([hm])/gi)) {
    matched = true;
    total += Number.parseInt(match[1]!, 10) * (match[2]!.toLowerCase() === "h" ? 60 : 1);
  }
  if (!matched) fail(`invalid duration '${value}'. Use minutes (e.g. 90) or a compound value (e.g. 1h30m).`);
  return total;
}

/** Render minutes for display: `1h 30m (90 min)`. */
export function formatMinutes(minutes: number | undefined | null): string {
  if (minutes === undefined || minutes === null) return "N/A";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}h ${rest}m (${minutes} min)`;
  if (hours) return `${hours}h (${minutes} min)`;
  return `${rest}m`;
}

/** Run `load` once and reuse the result for the lifetime of the process. */
export function memoize<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => (pending ??= load());
}
