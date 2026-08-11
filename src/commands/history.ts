import type { Group } from "../cli/dispatch.ts";
import { clear, historyPath, read, type HistoryEntry } from "../history.ts";
import { line, printList } from "../render/output.ts";
import { displayPath, stateRoot } from "../state.ts";

/**
 * Command history, kept per directory alongside the rest of `.plane/`, so each
 * checkout remembers its own work. Nothing is sent anywhere and credentials are
 * redacted before an entry is written.
 */
export const history: Group = {
  summary: "This directory's command history",
  prefix: "plane ",
  commands: {
    list: {
      usage: "history list [--limit=<n>] [--failed]",
      summary: "Recent commands run in this directory, newest last",
      async run({ args }) {
        const limit = Number.parseInt(args.str("limit") ?? "20", 10);
        const entries = read().filter((entry) => !args.bool("failed") || entry.status === "error");

        printList(entries.slice(-Math.max(limit, 1)), {
          title: "History",
          subject: `for ${displayPath(stateRoot())}`,
          empty: `No history yet for ${displayPath(stateRoot())}.`,
          entry: (recorded) => ({
            heading: `${recorded.at}  ${recorded.status === "ok" ? "ok " : "FAIL"}  ${duration(recorded)}`,
            details: [`plane ${recorded.argv.join(" ")}`, recorded.error && `-> ${firstLine(recorded.error)}`],
            next: [`plane ${recorded.argv.join(" ")}`],
          }),
        });
      },
    },

    clear: {
      usage: "history clear",
      summary: "Forget this directory's history",
      async run() {
        clear();
        line(`Cleared ${displayPath(historyPath())}`);
      },
    },

    path: {
      usage: "history path",
      summary: "Print where this directory's history is stored",
      async run() {
        line(historyPath());
      },
    },
  },
};

function duration(entry: HistoryEntry): string {
  return entry.ms >= 1000 ? `${(entry.ms / 1000).toFixed(1)}s` : `${entry.ms}ms`;
}

function firstLine(message: string): string {
  return message.split("\n")[0] ?? message;
}
