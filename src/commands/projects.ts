import type { Group } from "../cli/dispatch.ts";
import { note } from "../render/output.ts";
import * as views from "../render/views.ts";

export const projects: Group = {
  summary: "Projects in the workspace",
  prefix: "plane ",
  commands: {
    list: {
      usage: "projects list [--search=<text>]",
      summary: "List projects, with the UUID every other command needs",
      async run({ api, args }) {
        note("Fetching projects...");
        const search = (args.str("search") ?? "").toLowerCase();
        const all = await api.projects();
        const matching = search
          ? all.filter((project) =>
              project.name.toLowerCase().includes(search) ||
              (project.description ?? "").toLowerCase().includes(search))
          : all;
        views.projects(matching);
      },
    },
  },
};
