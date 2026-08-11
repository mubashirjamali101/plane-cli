import type { Group } from "../cli/dispatch.ts";
import { about } from "./about.ts";
import { assignees } from "./assignees.ts";
import { attachments } from "./attachments.ts";
import { comments } from "./comments.ts";
import { cycles, itemCycle } from "./cycles.ts";
import { images } from "./images.ts";
import { items } from "./items.ts";
import { itemLabels, labels } from "./labels.ts";
import { members } from "./members.ts";
import { projects } from "./projects.ts";
import { history } from "./history.ts";
import { states } from "./states.ts";
import { subissues } from "./subissues.ts";
import { links } from "./links.ts";
import { worklogs } from "./worklogs.ts";

/** Everything that hangs off `items`: the item verbs plus its sub-resources. */
const workItems: Group = {
  ...items,
  commands: {
    ...items.commands,
    images,
    assignee: assignees,
    label: itemLabels,
    comment: comments,
    link: links,
    worklog: worklogs,
    subissue: subissues,
    attachment: attachments,
    cycle: itemCycle,
  },
};

/**
 * The whole CLI as data: `--help` and every usage message are generated from this tree,
 * so documentation cannot drift from what the binary actually accepts.
 */
export const ROOT: Group = {
  summary: "Plane project management from the command line",
  prefix: "plane ",
  commands: {
    about,
    projects,
    history,
    // Everything below acts on one project, named by `project=<uuid>` or a .planerc default.
    items: { ...workItems, prefix: "plane project=<uuid> " },
    labels: { ...labels, prefix: "plane project=<uuid> " },
    cycles: { ...cycles, prefix: "plane project=<uuid> " },
    states: { ...states, prefix: "plane project=<uuid> " },
    members: { ...members, prefix: "plane project=<uuid> " },
  },
};

/** Top-level resources that act on a project, in the order help lists them. */
export const PROJECT_RESOURCES = ["items", "labels", "cycles", "states", "members"] as const;
