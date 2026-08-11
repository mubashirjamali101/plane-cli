import { readFileSync, writeFileSync } from "node:fs";
import type { ProjectApi } from "./api/index.ts";
import type { Args } from "./cli/args.ts";
import type { Context } from "./cli/dispatch.ts";
import { CliError } from "./errors.ts";
import { DIVIDER, line, RULE } from "./render/output.ts";
import { displayPath, ensureStateDir, statePath } from "./state.ts";

/**
 * What a command does to the workspace. Read-only commands declare nothing.
 *
 * The first write against a given project stops and asks for confirmation, once,
 * naming the project and what is about to change. Plane has no undo, and an agent
 * acting on a half-understood instruction can rewrite a board in seconds.
 */
export interface WriteEffect {
  action: "create" | "update" | "delete";
  /** Plain-language noun for what is affected, e.g. "comment", "work item". */
  what: string;
  /**
   * A consequence beyond the obvious, phrased to follow "This also …" — for the
   * commands whose blast radius is wider than their name suggests.
   */
  note?: string;
}

/** Exit code when a write is blocked pending confirmation, distinct from a plain error. */
export const NEEDS_CONFIRMATION = 2;

const ACK_FILE = "write-ack.json";

function ackPath(): string {
  return statePath(ACK_FILE);
}

function loadAck(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(readFileSync(ackPath(), "utf-8"));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function isAcknowledged(projectId: string): boolean {
  return Boolean(loadAck()[projectId]);
}

export function acknowledge(projectId: string, now = new Date()): void {
  try {
    ensureStateDir();
    writeFileSync(ackPath(), JSON.stringify({ ...loadAck(), [projectId]: now.toISOString() }, null, 2) + "\n");
  } catch {
    // Failing to remember the acknowledgement only means asking again next time.
  }
}

/** The flags that describe an intended change, in the order a person would say them. */
const CHANGE_FLAGS: [flag: string, label: string][] = [
  ["title", "title"],
  ["state", "state"],
  ["priority", "priority"],
  ["assignee", "assignee"],
  ["label", "label"],
  ["cycle", "cycle"],
  ["parent", "parent"],
  ["description", "description"],
  ["description-html", "description"],
  ["message", "comment text"],
  ["message-html", "comment text"],
  ["duration", "time logged"],
  ["url", "url"],
  ["name", "name"],
  ["color", "colour"],
  ["group", "group"],
  ["start-date", "start date"],
  ["end-date", "end date"],
  ["file", "file"],
  ["child", "child items"],
  ["item", "items"],
];

function changeSummary(args: Args): string[] {
  return CHANGE_FLAGS.filter(([flag]) => args.has(flag)).map(([flag, label]) => {
    const value = args.str(flag);
    return value === undefined || value === "" ? `${label} cleared` : `${label} -> ${value}`;
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The thing a command acts on, named for a person and identified for a machine. */
interface Subject {
  /** Row label: whether this is the thing changed, or where the change happens. */
  label: "Affects" | "On item";
  /** Just the name, for the sentence an agent should say out loud. */
  short: string;
  /** Name and id, for the precise record above it. */
  full: string;
}

/**
 * Resolve the first positional against whatever the usage line says it is.
 *
 * `labels delete <label-id>` and `items comment delete <item-id> <comment-id>` both
 * lead with a UUID, but they mean entirely different things — assuming every id is a
 * work item produced notices like "delete a label on <uuid>".
 */
async function describeSubject(
  context: Context,
  usage: string,
  effect: WriteEffect
): Promise<Subject | undefined> {
  const id = context.args.positionals.find((value) => UUID.test(value));
  if (!id) return undefined;

  const placeholder = usage.match(/<([a-z]+)-id>/)?.[1] ?? "";
  const project = context.project;

  const name = await lookupName(project, placeholder, id);
  const quoted = name ? `'${name}'` : id;
  const full = name ? `'${name}' (${id})` : id;

  // A work item named alongside a sub-resource is the container, not the target.
  const isContainer = (placeholder === "item" || placeholder === "parent") && effect.what !== "work item";
  return { label: isContainer ? "On item" : "Affects", short: quoted, full };
}

async function lookupName(
  project: ProjectApi,
  placeholder: string,
  id: string
): Promise<string | undefined> {
  try {
    switch (placeholder) {
      case "item":
      case "parent":
        return (await project.items.get(id)).name;
      case "label":
        return (await project.labelNames()).get(id);
      case "state":
        return (await project.stateNames()).get(id);
      case "cycle":
        return (await project.cycleNames()).get(id);
      default:
        return undefined; // comment/link/worklog/attachment ids have no cheap name.
    }
  } catch {
    return undefined; // An id we cannot resolve is still reported, just without a name.
  }
}

async function projectName(context: Context): Promise<{ short: string; full: string }> {
  const id = context.project.id;
  try {
    const match = (await context.api.projects()).find((project) => project.id === id);
    if (match) return { short: `'${match.name}'`, full: `${match.name} (${id})` };
  } catch {
    // Fall through to the id, which is always correct if less friendly.
  }
  return { short: id, full: id };
}

const VERBS: Record<WriteEffect["action"], string> = {
  create: "CREATE",
  update: "MODIFY",
  delete: "DELETE",
};

const SPOKEN: Record<WriteEffect["action"], string> = {
  create: "create",
  update: "change",
  delete: "delete",
};

/** The sentence an assistant can read to its user, wrapped to stay readable. */
function spokenRequest(
  effect: WriteEffect,
  where: { short: string },
  subject: Subject | undefined,
  changes: string[]
): string[] {
  const article = effect.action === "update" ? "the" : "a";
  let what: string;
  if (!subject) what = `${article} ${effect.what}`;
  else if (subject.label === "On item") what = `${article} ${effect.what} on ${subject.short}`;
  else what = `the ${effect.what} ${subject.short}`;

  const detail = changes.length ? ` — ${changes.join(", ")}` : "";
  return [
    `"This will ${SPOKEN[effect.action]} ${what}`,
    ` in the Plane project ${where.short}${detail}.`,
    ...(effect.note ? [` This also ${effect.note}.`] : []),
    ` Shall I go ahead?"`,
  ];
}

/**
 * Show the one-time notice and require confirmation.
 *
 * Returns normally when the command may proceed; throws otherwise. Confirmation is
 * remembered per project in `.plane/`, so this interrupts a person, or an agent,
 * exactly once per project per checkout.
 */
export async function confirmWrite(context: Context, command: { usage: string; writes?: WriteEffect }): Promise<void> {
  const effect = command.writes;
  if (!effect) return;

  const projectId = context.project.id;
  if (isAcknowledged(projectId)) return;

  const preapproved = context.args.bool("yes") || process.env.PLANE_ASSUME_YES === "1";
  if (preapproved) {
    acknowledge(projectId);
    return;
  }

  const [where, subject] = await Promise.all([
    projectName(context),
    describeSubject(context, command.usage, effect),
  ]);
  const changes = changeSummary(context.args);
  const invocation = `plane ${process.argv.slice(2).join(" ")}`;

  line(`\n${RULE}`);
  line(`CONFIRM BEFORE WRITING — shown once for this project`);
  line(DIVIDER);
  line(`This command will ${VERBS[effect.action]} real data in Plane. It is not a dry run,`);
  line(`it takes effect immediately, and this CLI cannot undo it.\n`);
  line(`  Action    ${VERBS[effect.action]} ${effect.what}`);
  line(`  Project   ${where.full}`);
  if (subject) line(`  ${subject.label.padEnd(9)} ${subject.full}`);
  if (changes.length) line(`  Changes   ${changes.join("\n            ")}`);
  if (effect.note) line(`  Note      this also ${effect.note}`);
  line(`  Command   ${invocation}`);
  line("");
  line(`IF YOU ARE AN AI AGENT OR ASSISTANT:`);
  line(`Stop here and confirm with the person you are working for, in plain words,`);
  line(`before running this again. Say what will change and where, for example:`);
  line("");
  for (const sentence of spokenRequest(effect, where, subject, changes)) line(`    ${sentence}`);
  line("");
  line(`Do not answer on their behalf, and do not re-run this command until they`);
  line(`have said yes. Once they agree, add --yes to the command.`);
  line(DIVIDER);
  line(`This notice appears once per project. After it is acknowledged, writes run`);
  line(`without interruption — the record is kept in ${displayPath(ackPath())}.`);
  line(`Delete that file to be asked again.`);
  line(`${RULE}\n`);

  if (process.stdin.isTTY) {
    const answer = prompt("Type 'yes' to confirm this and future writes to this project:");
    if (answer?.trim().toLowerCase() !== "yes") {
      throw new CliError("cancelled — nothing was changed.", NEEDS_CONFIRMATION);
    }
    acknowledge(projectId);
    return;
  }

  throw new CliError(
    "write not performed — confirmation required (see the notice above).\n" +
      "After the person you are working for has agreed, re-run the same command with --yes.",
    NEEDS_CONFIRMATION
  );
}
