import { aboutHeader } from "../about.ts";
import { ROOT } from "../commands/index.ts";
import { globalRcPath, RC_FILENAME, type Origin, type Settings } from "../config.ts";
import { fail } from "../errors.ts";
import { line } from "../render/output.ts";
import { isGroup, walk, type Command, type Group } from "./dispatch.ts";

const STATUS: Record<Origin, string> = {
  env: "[set: env]     ",
  rc: `[set: ${RC_FILENAME}]`,
  none: "[not set]      ",
};

/** `plane --help`: how to configure the CLI, then every command it accepts. */
export function showHelp(settings: Settings): void {
  line(`
${aboutHeader()}

SETTINGS  (environment variable, or ${RC_FILENAME}; the environment wins)
  PLANE_API_KEY     ${STATUS[settings.origins.apiKey]} API key from Plane > Settings > API tokens
  PLANE_WORKSPACE   ${STATUS[settings.origins.workspace]} Workspace slug, e.g. "acme"
  PLANE_BASE_URL    ${STATUS[settings.origins.baseUrl]} Instance API root, e.g. "https://plane.example.com/api/v1"
  PLANE_PROJECT     ${STATUS[settings.origins.project]} Default project UUID, so 'project=<uuid>' can be omitted

CONFIG FILE  (${RC_FILENAME} in this directory tree, or ${globalRcPath()})
  api_key=plane_api_...
  workspace=acme
  base_url=https://plane.example.com/api/v1
  project=<uuid>                 # default project
  default_states=Todo,In Progress # default 'items list' filter; unset means every state

  Each setting resolves on its own: environment variable > nearest ${RC_FILENAME} > ${globalRcPath()}.
  Credentials can live in the global file while a repository's ${RC_FILENAME} pins only the project.
  Never commit a ${RC_FILENAME} containing an api_key.
`);

  for (const [name, node] of Object.entries(ROOT.commands)) {
    line(`${name.toUpperCase()}  — ${node.summary}`);
    for (const command of usageLines(node)) line(indent(command.usage));
    line("");
  }

  line(`NOTES
  project=<uuid>      A positional argument, not a flag, and it comes first. No spaces around '='.
                      Omit it entirely once a default project is configured.
  --state / --cycle   Take a human name and resolve it to a UUID; --cycle and --label also accept UUIDs.
  --assignee/--label  Comma-separated lists, resolved against project members and labels.
  --duration          Minutes (90) or compound (1h30m).
  items show          Prints the complete description. --html dumps the raw HTML, --output=json the raw item.
  Next steps          Every listing ends with copy-paste-ready commands with the real UUIDs filled in.

  plane help <command>   Detail for one area, e.g. 'plane help items comment'.
  plane about            Author, credits and licence. Also 'plane --about'.
`);
}

/** `plane help <path…>`: the usage lines and summaries beneath one part of the tree. */
export function showTopic(path: readonly string[]): void {
  let node: Group = ROOT;
  for (const step of path) {
    const child = node.commands[step];
    if (!child) fail(`no help for '${path.join(" ")}'. Try 'plane --help'.`);
    if (!isGroup(child)) {
      line(`\n${indent((node.prefix ?? ROOT.prefix ?? "") + child.usage)}\n      ${child.summary}\n`);
      return;
    }
    node = child;
  }

  line(`\n${path.join(" ") || "plane"} — ${node.summary}\n`);
  for (const command of walk(node, ROOT.prefix)) {
    line(indent(command.usage));
    line(`      ${command.summary}`);
  }
  line("");
}

/** The usage lines beneath a node, whether it is a group or a single command. */
function usageLines(node: Command | Group): { usage: string; summary: string }[] {
  if (isGroup(node)) return walk(node, ROOT.prefix);
  return [{ usage: (ROOT.prefix ?? "") + node.usage, summary: node.summary }];
}

/** Indent a usage line, keeping wrapped continuation lines aligned under it. */
function indent(usage: string): string {
  return `  ${usage.replace(/\n/g, "\n      ")}`;
}
