import type { Group } from "../cli/dispatch.ts";
import { ApiError, CliError } from "../errors.ts";
import { cmd, line, next } from "../render/output.ts";
import * as views from "../render/views.ts";
import { formatMinutes } from "../util.ts";

/**
 * Worklog endpoints only exist on Plane editions with time tracking enabled; elsewhere
 * they 404. Say so, rather than leaving a bare "not found" that reads like a bad item id.
 */
async function withTimeTracking<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new CliError(
        `${error.message}\n\n` +
          `This Plane instance has no worklog endpoint — time tracking is only available on\n` +
          `editions and plans that enable it. 'items show' still reports the read-only\n` +
          `'Total time logged' field.`
      );
    }
    throw error;
  }
}

export const worklogs: Group = {
  summary: "Time logged against a work item",
  commands: {
    list: {
      usage: "items worklog list <item-id>",
      summary: "List worklogs and their total",
      async run({ api, project, args }) {
        const itemId = args.at(0, "<item-id>");
        const [logs, members] = await Promise.all([
          withTimeTracking(() => project.item(itemId).worklogs.list()),
          api.memberNames(),
        ]);
        views.worklogs(logs, members, project.id, itemId);
      },
    },

    add: {
      usage: "items worklog add <item-id> --duration=<90|1h30m> [--description=<text>]",
      writes: { action: "create", what: "worklog" },
      summary: "Log time against the item",
      async run({ project, args }) {
        const item = project.item(args.at(0, "<item-id>"));
        const duration = args.minutes("duration");
        if (duration === undefined) {
          args.require("duration"); // reports the usage line for a missing flag
        }

        const created = await withTimeTracking(() =>
          item.worklogs.create({ duration, ...args.payload({ description: "description" }) }));

        line(`Logged ${formatMinutes(duration)}.  Worklog ID: ${created.id}`);
        next([
          `${cmd(project.id)} items worklog list ${item.id}`,
          `${cmd(project.id)} items worklog update ${item.id} ${created.id} --duration=<mins>`,
          `${cmd(project.id)} items worklog delete ${item.id} ${created.id}`,
        ]);
      },
    },

    update: {
      usage: "items worklog update <item-id> <worklog-id> [--duration=<90|1h30m>] [--description=<text>]",
      writes: { action: "update", what: "worklog" },
      summary: "Correct a worklog",
      async run({ project, args }) {
        const item = project.item(args.at(0, "<item-id>"));
        const worklogId = args.at(1, "<worklog-id>");
        const duration = args.minutes("duration");
        const payload = args.requireSome(
          {
            ...(duration === undefined ? {} : { duration }),
            ...args.payload({ description: "description" }),
          },
          "--duration and/or --description"
        );

        await withTimeTracking(() => item.worklogs.update(worklogId, payload));
        line(`Updated worklog ${worklogId}`);
      },
    },

    delete: {
      usage: "items worklog delete <item-id> <worklog-id>",
      writes: { action: "delete", what: "worklog" },
      summary: "Delete a worklog",
      async run({ project, args }) {
        const worklogId = args.at(1, "<worklog-id>");
        await withTimeTracking(() => project.item(args.at(0, "<item-id>")).worklogs.remove(worklogId));
        line(`Deleted worklog ${worklogId}`);
      },
    },
  },
};
