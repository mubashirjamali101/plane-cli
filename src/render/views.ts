import type {
  Activity, Attachment, Comment, Cycle, Label, Link, Member, MemberProfile,
  Project, State, WorkItem, Worklog,
} from "../api/index.ts";
import { displayName } from "../api/index.ts";
import { formatMinutes } from "../util.ts";
import { embeddedImages, toText } from "./html.ts";
import { cmd, line, next, printFields, printList, RULE } from "./output.ts";

/** Names for the ids stored on a work item, so a detail view reads in English. */
export interface Lookups {
  states: Map<string, string>;
  labels: Map<string, string>;
  cycles: Map<string, string>;
  members: Map<string, string>;
}

const upper = (value: string | undefined) => (value || "N/A").toUpperCase();
const named = (index: Map<string, string>, id: string | null | undefined, fallback = "None") =>
  id ? index.get(id) ?? id : fallback;

export function projects(items: Project[]): void {
  printList(items, {
    title: "Projects",
    empty: "No projects found.",
    entry: (project, index) => ({
      heading: `${index + 1}. ${project.name}`,
      details: [
        `ID: ${project.id}`,
        project.description && `Description: ${project.description.slice(0, 100)}`,
      ],
      next: [
        `${cmd(project.id)} items list`,
        `${cmd(project.id)} items list --priority=urgent`,
        `${cmd(project.id)} labels list`,
        `${cmd(project.id)} cycles list`,
      ],
    }),
  });
}

export function workItems(
  items: WorkItem[],
  options: { projectId: string; states: Map<string, string>; verbose: boolean }
): void {
  const { projectId, states, verbose } = options;
  printList(items, {
    title: "Work items",
    empty: "No work items found.",
    emptyNext: [`${cmd(projectId)} items list --state=<name>`, `${cmd(projectId)} states list`],
    entry: (item, index) => ({
      heading: `${index + 1}. ${item.name}`,
      details: [
        `Priority: ${upper(item.priority)} | State: ${named(states, item.state, "N/A")}`,
        `ID: ${item.id}`,
        `Created: ${item.created_at}`,
        verbose && `Updated: ${item.updated_at}`,
        verbose && `Description: ${toText(item.description_html) || "N/A"}`,
      ],
      next: [
        `${cmd(projectId)} items show ${item.id}`,
        `${cmd(projectId)} items update ${item.id} --state="<name>"`,
        `${cmd(projectId)} items assignee add ${item.id} --assignee=<email>`,
        `${cmd(projectId)} items comment add ${item.id} --message="<text>"`,
      ],
    }),
  });
}

export function workItem(item: WorkItem, lookups: Lookups, projectId: string): void {
  const assignees = (item.assignees ?? []).map((id) => lookups.members.get(id) ?? id);
  const labels = (item.labels ?? []).map((id) => lookups.labels.get(id) ?? id);
  const description = toText(item.description_html);
  const imageCount = embeddedImages(item.description_html).length;

  line(`\n${RULE}`);
  printFields([
    ["ID", item.id],
    ["Name", item.name],
    ["Priority", upper(item.priority)],
    ["State", named(lookups.states, item.state, "N/A")],
    ["Assignees", assignees.join(", ") || "None"],
    ["Labels", labels.join(", ") || "None"],
    ["Cycle", named(lookups.cycles, item.cycle)],
    ["Parent", item.parent ?? "None"],
    ["Created", item.created_at],
    ["Updated", item.updated_at],
    ["Start date", item.start_date ?? "N/A"],
    ["Due date", item.target_date ?? item.due_date ?? "N/A"],
    ["Total time logged", String(item.total_time_logged ?? "N/A")],
    ["Images in body", String(imageCount)],
  ]);

  // A screenshot-only ticket has no text at all. Printing a bare "N/A" reads as "no
  // content", which is how such tickets end up triaged on their title alone.
  const noDescription = imageCount
    ? `N/A — this item's content is ${imageCount} image(s). Run: ${cmd(projectId)} items images ${item.id} --download`
    : "N/A";
  line(`\nDescription:\n${description || noDescription}\n`);

  next([
    `${cmd(projectId)} items update ${item.id} --state="<name>" --priority=high`,
    `${cmd(projectId)} items assignee add ${item.id} --assignee=<email>`,
    `${cmd(projectId)} items label add ${item.id} --label=<name>`,
    `${cmd(projectId)} items comment add ${item.id} --message="<text>"`,
    `${cmd(projectId)} items worklog add ${item.id} --duration=90 --description="<text>"`,
    `${cmd(projectId)} items link add ${item.id} --url=<url> --title="<text>"`,
    `${cmd(projectId)} items subissue list ${item.id}`,
    `${cmd(projectId)} items attachment list ${item.id}`,
    ...(imageCount ? [`${cmd(projectId)} items images ${item.id} --download`] : []),
    `${cmd(projectId)} items activity ${item.id}`,
  ]);
  line(RULE);
}

export function activity(entries: Activity[], members: Map<string, string>): void {
  if (!entries.length) {
    line("No activity found.");
    return;
  }
  line(`\n${RULE}`);
  line(`Activity (${entries.length})\n`);

  for (const entry of entries) {
    const actorId = entry.actor ?? entry.actor_detail?.id ?? "";
    const actor = members.get(actorId) ?? actorId ?? "system";
    const field = entry.field ?? "";
    const body = entry.comment ?? entry.new_value ?? "";

    if (field.includes("comment")) {
      line(`${entry.created_at} | ${actor} | ${entry.verb} comment: ${toText(body, 200)}`);
    } else if (field) {
      line(`${entry.created_at} | ${actor} | ${entry.verb} ${field}: ${entry.old_value ?? ""} -> ${entry.new_value ?? ""}`);
    } else {
      line(`${entry.created_at} | ${actor} | ${entry.verb} ${body}`);
    }
  }
}

export function comments(items: Comment[], members: Map<string, string>, projectId: string, itemId: string): void {
  const add = `${cmd(projectId)} items comment add ${itemId} --message="<text>"`;
  printList(items, {
    title: "Comments",
    subject: `on item ${itemId}`,
    empty: "No comments found.",
    emptyNext: [add],
    entry: (comment) => ({
      heading: `${(comment.actor && members.get(comment.actor)) || comment.actor || "unknown"}  |  ${comment.created_at ?? ""}`,
      details: [
        `ID: ${comment.id}`,
        toText(comment.comment_html || comment.comment_stripped) || "(empty)",
      ],
      next: [
        `${cmd(projectId)} items comment update ${itemId} ${comment.id} --message="<text>"`,
        `${cmd(projectId)} items comment delete ${itemId} ${comment.id}`,
      ],
    }),
    footer: { label: "Add another", commands: [add] },
  });
}

export function links(items: Link[], projectId: string, itemId: string): void {
  const add = `${cmd(projectId)} items link add ${itemId} --url=<url> --title="<text>"`;
  printList(items, {
    title: "Links",
    subject: `on item ${itemId}`,
    empty: "No links found.",
    emptyNext: [add],
    entry: (link) => ({
      heading: link.title || "(untitled)",
      details: [link.url, `ID: ${link.id}`],
      next: [
        `${cmd(projectId)} items link update ${itemId} ${link.id} --url=<url> --title="<text>"`,
        `${cmd(projectId)} items link delete ${itemId} ${link.id}`,
      ],
    }),
    footer: { label: "Add another", commands: [add] },
  });
}

export function worklogs(items: Worklog[], members: Map<string, string>, projectId: string, itemId: string): void {
  const add = `${cmd(projectId)} items worklog add ${itemId} --duration=90 --description="<text>"`;
  const total = items.reduce((sum, log) => sum + (log.duration ?? 0), 0);
  printList(items, {
    title: "Worklogs",
    subject: `on item ${itemId} — total ${formatMinutes(total)}`,
    empty: "No worklogs found.",
    emptyNext: [add],
    entry: (log) => ({
      heading: `${formatMinutes(log.duration)}  |  ${(log.logged_by && members.get(log.logged_by)) || log.logged_by || "unknown"}  |  ${log.created_at ?? ""}`,
      details: [`ID: ${log.id}`, log.description],
      next: [
        `${cmd(projectId)} items worklog update ${itemId} ${log.id} --duration=<mins>`,
        `${cmd(projectId)} items worklog delete ${itemId} ${log.id}`,
      ],
    }),
    footer: { label: "Add another", commands: [add] },
  });
}

export function labels(items: Label[], projectId: string): void {
  const create = `${cmd(projectId)} labels create --name=<text> --color=#0693E3`;
  printList(items, {
    title: "Labels",
    empty: "No labels found.",
    emptyNext: [create],
    entry: (label) => ({
      heading: `${label.name}${label.color ? `  ${label.color}` : ""}`,
      details: [`ID: ${label.id}`, label.description],
      next: [
        `${cmd(projectId)} labels update ${label.id} --name="<text>" --color=#0693E3`,
        `${cmd(projectId)} labels delete ${label.id}`,
        `${cmd(projectId)} items label add <item-id> --label="${label.name}"`,
      ],
    }),
    footer: { label: "Create another", commands: [create] },
  });
}

export function cycles(items: Cycle[], projectId: string): void {
  const create = `${cmd(projectId)} cycles create --name=<text> --start-date=YYYY-MM-DD --end-date=YYYY-MM-DD`;
  printList(items, {
    title: "Cycles",
    empty: "No cycles found.",
    emptyNext: [create],
    entry: (cycle) => {
      const span = [cycle.start_date, cycle.end_date].filter(Boolean).join(" -> ");
      return {
        heading: `${cycle.name}${span ? `  (${span})` : ""}`,
        details: [`ID: ${cycle.id}`, cycle.description],
        next: [
          `${cmd(projectId)} cycles update ${cycle.id} --name="<text>"`,
          `${cmd(projectId)} cycles delete ${cycle.id}`,
          `${cmd(projectId)} cycles add-items ${cycle.id} --item=<item-uuid>`,
          `${cmd(projectId)} items cycle set <item-id> --cycle="${cycle.name}"`,
        ],
      };
    },
    footer: { label: "Create another", commands: [create] },
  });
}

export function states(items: State[], projectId: string): void {
  const create = `${cmd(projectId)} states create --name=<text> --group=backlog|unstarted|started|completed|cancelled`;
  printList(items, {
    title: "States",
    empty: "No states found.",
    emptyNext: [create],
    entry: (state) => {
      const tags = [state.group, state.color, state.default ? "default" : ""].filter(Boolean).join("  ");
      return {
        heading: `${state.name}${tags ? `  [${tags}]` : ""}`,
        details: [`ID: ${state.id}`, state.description],
        next: [
          `${cmd(projectId)} items list --state="${state.name}"`,
          `${cmd(projectId)} items update <item-id> --state="${state.name}"`,
          `${cmd(projectId)} states update ${state.id} --name="<text>" --color=#0693E3`,
          `${cmd(projectId)} states delete ${state.id}`,
        ],
      };
    },
    footer: { label: "Create another", commands: [create] },
  });
}

const ROLES: Record<number, string> = { 5: "Guest", 10: "Viewer", 15: "Member", 20: "Admin" };

export function members(items: Member[], projectId: string): void {
  printList(items, {
    title: "Members",
    empty: "No members found.",
    entry: (member) => {
      const profile: MemberProfile = member.member ?? member;
      const email = profile.email ?? "(no email)";
      const role = member.role === undefined ? "" : ROLES[member.role] ?? `role ${member.role}`;
      return {
        heading: `${displayName(profile)}  <${email}>${role ? `  [${role}]` : ""}`,
        details: [`ID: ${member.id}`],
        next: [
          `${cmd(projectId)} items list --assignee=${email}`,
          `${cmd(projectId)} items assignee add <item-id> --assignee=${email}`,
        ],
      };
    },
  });
}

export function attachments(items: Attachment[], projectId: string, itemId: string): void {
  const upload = `${cmd(projectId)} items attachment upload ${itemId} --file=<path>`;
  printList(items, {
    title: "Attachments",
    subject: `on item ${itemId}`,
    empty: "No attachments found.",
    emptyNext: [upload],
    entry: (attachment) => {
      const size = attachment.attributes?.size;
      return {
        heading: `${attachment.attributes?.name ?? "(unnamed)"}${size ? `  (${size} bytes)` : ""}`,
        details: [`ID: ${attachment.id}`],
        next: [
          `${cmd(projectId)} items attachment download ${itemId} ${attachment.id}`,
          `${cmd(projectId)} items attachment delete ${itemId} ${attachment.id}`,
        ],
      };
    },
    footer: { label: "Upload another", commands: [upload] },
  });
}

export function subIssues(items: WorkItem[], states: Map<string, string>, projectId: string, parentId: string): void {
  const add = [
    `${cmd(projectId)} items subissue create ${parentId} --title="<text>"`,
    `${cmd(projectId)} items subissue add ${parentId} --child=<item-uuid>`,
  ];
  printList(items, {
    title: "Sub-issues",
    subject: `under ${parentId}`,
    empty: "No sub-issues found.",
    emptyNext: add,
    entry: (item) => ({
      heading: item.name,
      details: [
        `State: ${named(states, item.state, "N/A")}  |  Priority: ${upper(item.priority)}`,
        `ID: ${item.id}`,
      ],
      next: [
        `${cmd(projectId)} items show ${item.id}`,
        `${cmd(projectId)} items subissue remove ${parentId} --child=${item.id}`,
      ],
    }),
    footer: { label: "Add another", commands: add },
  });
}

/** Names and ids of the assignees or labels currently on an item. */
export function idList(title: string, ids: readonly string[], names: Map<string, string>, followUps: string[]): void {
  if (!ids.length) {
    line(`No ${title}.`);
  } else {
    for (const id of ids) line(`${names.get(id) ?? id}  (${id})`);
  }
  next(followUps);
}
