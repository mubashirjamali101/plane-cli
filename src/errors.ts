/**
 * Errors that are meant for the person at the terminal.
 *
 * Nothing below the CLI layer calls `process.exit`: library code throws, and
 * `main()` turns a `CliError` into a clean one-line message. Anything else
 * escapes as a real crash with a stack trace, which is what you want from a bug.
 */

export class CliError extends Error {
  constructor(message: string, readonly exitCode: number = 1) {
    super(message);
    this.name = "CliError";
  }
}

/** A non-2xx response from the Plane API, with the server's own detail attached. */
export class ApiError extends CliError {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly method: string,
    readonly url: string,
    readonly detail: string
  ) {
    super(
      `Plane API ${status} ${statusText}\n  ${method} ${url}` +
        (detail ? `\n  ${detail.trim()}` : "")
    );
    this.name = "ApiError";
  }
}

/** Abort the current command with a message for the user. */
export function fail(message: string): never {
  throw new CliError(message);
}
