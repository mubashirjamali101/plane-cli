#!/usr/bin/env bun
import { AGENT_NOTICE_SHORT, CREDIT, VERSION, aboutText } from "./about.ts";
import { PlaneApi } from "./api/index.ts";
import { Args } from "./cli/args.ts";
import { Context, resolve } from "./cli/dispatch.ts";
import { showHelp, showTopic } from "./cli/help.ts";
import { ROOT } from "./commands/index.ts";
import { initGlobalRc, loadSettings, requireConfig, requireProject } from "./config.ts";
import { confirmWrite } from "./confirm.ts";
import { CliError, fail } from "./errors.ts";
import { record } from "./history.ts";
import { line, note } from "./render/output.ts";

const PROJECT_PREFIX = "project=";

async function main(argv: string[]): Promise<void> {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    showHelp(loadSettings());
    return;
  }
  if (argv[0] === "help") {
    showTopic(argv.slice(1));
    return;
  }
  if (argv[0] === "--about") {
    line(aboutText());
    return;
  }
  if (argv[0] === "--version" || argv[0] === "-V") {
    // The bare version goes to stdout so `plane --version` stays scriptable; the
    // credit goes to stderr, where a person (or an agent reading the session) sees it.
    line(VERSION);
    note(`${CREDIT}\n${AGENT_NOTICE_SHORT}`);
    return;
  }

  // `project=<uuid>` is positional and, when present, always comes first.
  const explicitProject = argv[0]!.startsWith(PROJECT_PREFIX)
    ? argv[0]!.slice(PROJECT_PREFIX.length) || fail("project=<uuid> is empty. Usage: plane project=<uuid> items list")
    : undefined;
  const tokens = explicitProject === undefined ? argv : argv.slice(1);

  const settings = loadSettings();
  const { command, rest, usage } = resolve(ROOT, tokens);
  const context = new Context(
    Args.parse(rest, usage),
    settings,
    () => {
      // Deferred until a command actually needs the server, so `history` works without keys.
      initGlobalRc({ ...settings, project: explicitProject ?? settings.project });
      return new PlaneApi(requireConfig(settings));
    },
    (api) => api.project(requireProject(settings, explicitProject))
  );

  await withHistory(argv, explicitProject ?? settings.project, async () => {
    // Writing commands stop once per project to have their effect confirmed.
    await confirmWrite(context, command);
    await command.run(context);
  });
}

/** Run the command, then record it in this directory's history either way. */
async function withHistory(
  argv: readonly string[],
  project: string | undefined,
  run: () => Promise<void>
): Promise<void> {
  // Reading history should not itself become history.
  if (argv[0] === "history") return run();

  const started = Date.now();
  try {
    await run();
    record({ at: new Date().toISOString(), argv, project, status: "ok", ms: Date.now() - started });
  } catch (error) {
    record({
      at: new Date().toISOString(),
      argv,
      project,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      ms: Date.now() - started,
    });
    throw error;
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  if (error instanceof CliError) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exit(error.exitCode);
  }
  // Anything else is a bug in the CLI: show the stack rather than pretending otherwise.
  throw error;
});
