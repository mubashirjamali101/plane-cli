import type { Group } from "../cli/dispatch.ts";
import * as views from "../render/views.ts";

/** Read-only: the Plane API does not expose membership management. */
export const members: Group = {
  summary: "People on the project",
  commands: {
    list: {
      usage: "members list",
      summary: "List members; the emails shown are what --assignee accepts",
      async run({ project }) {
        views.members(await project.members(), project.id);
      },
    },
  },
};
