import { fail } from "../errors.ts";
import { parseDuration, splitList } from "../util.ts";

/**
 * A parsed command tail: leading positionals, then flags.
 *
 * Every accessor validates and reports against the command's own usage line, so
 * handlers can read arguments directly instead of re-checking each one.
 */
export class Args {
  private constructor(
    readonly positionals: readonly string[],
    private readonly flags: ReadonlyMap<string, string | boolean>,
    private readonly usage: string
  ) {}

  /**
   * Parse `<positional>... [--flag[=value]]...`.
   *
   * Accepted flag forms: `--name=value`, `--name value`, bare `--name` (true),
   * and `-v` as an alias for `--verbose`. Positionals must come before flags.
   */
  static parse(tokens: readonly string[], usage = ""): Args {
    const positionals: string[] = [];
    const flags = new Map<string, string | boolean>();
    let seenFlag = false;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]!;

      if (token === "-v" || token === "--verbose") {
        seenFlag = true;
        flags.set("verbose", true);
        continue;
      }
      if (!token.startsWith("--")) {
        if (!seenFlag) positionals.push(token);
        continue;
      }
      seenFlag = true;

      const equals = token.indexOf("=");
      if (equals !== -1) {
        flags.set(token.slice(2, equals), token.slice(equals + 1));
        continue;
      }
      const next = tokens[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags.set(token.slice(2), next);
        i++;
      } else {
        flags.set(token.slice(2), true);
      }
    }

    return new Args(positionals, flags, usage);
  }

  withUsage(usage: string): Args {
    return new Args(this.positionals, this.flags, usage);
  }

  // ---- positionals ----

  /** The positional at `index`, or a usage error naming what was missing. */
  at(index: number, name: string): string {
    const value = this.positionals[index];
    if (value === undefined) fail(`missing ${name}.${this.usageHint()}`);
    return value;
  }

  optionalAt(index: number): string | undefined {
    return this.positionals[index];
  }

  // ---- flags ----

  has(name: string): boolean {
    return this.flags.has(name);
  }

  /** The value of `--name`, or undefined when absent or passed as a bare boolean. */
  str(name: string): string | undefined {
    const value = this.flags.get(name);
    return typeof value === "string" ? value : undefined;
  }

  /** The value of `--name`, or a usage error when it is missing or empty. */
  require(name: string): string {
    const value = this.str(name);
    if (!value) fail(`--${name} is required.${this.usageHint()}`);
    return value;
  }

  bool(name: string): boolean {
    return this.flags.get(name) === true;
  }

  /** A comma-separated flag as a list; a usage error when it is missing or empty. */
  requireList(name: string): string[] {
    const values = splitList(this.str(name));
    if (!values.length) fail(`--${name}=<value>[,<value>] is required.${this.usageHint()}`);
    return values;
  }

  list(name: string): string[] {
    return splitList(this.str(name));
  }

  /** A `--name` duration (`90`, `1h30m`) in minutes, or undefined when absent. */
  minutes(name: string): number | undefined {
    const value = this.str(name);
    return value === undefined ? undefined : parseDuration(value);
  }

  /**
   * Collect present flags into an API payload, mapping flag name -> field name.
   * A flag passed as `--name=` yields an empty string, which is how a field is cleared.
   */
  payload(mapping: Record<string, string>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const [flag, field] of Object.entries(mapping)) {
      if (this.has(flag)) payload[field] = this.str(flag) ?? "";
    }
    return payload;
  }

  /** Fail unless at least one field was supplied — the "nothing to update" guard. */
  requireSome(payload: Record<string, unknown>, what: string): Record<string, unknown> {
    if (!Object.keys(payload).length) fail(`nothing to update — provide ${what}.${this.usageHint()}`);
    return payload;
  }

  private usageHint(): string {
    return this.usage ? `\nusage: ${this.usage}` : "";
  }
}
