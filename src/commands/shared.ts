import type { ProjectApi } from "../api/index.ts";
import type { Args } from "../cli/args.ts";

/** How a multi-value edit (`assignee`/`label`) changes the current set. */
export type SetMode = "add" | "remove" | "set" | "clear";

export const SET_MODES: SetMode[] = ["add", "remove", "set", "clear"];

/**
 * Apply an add/remove/set/clear edit to a list field on a work item.
 *
 * `add` and `remove` read the item first so they genuinely amend the list; `set`
 * replaces it wholesale. Returns the field as the API reports it afterwards.
 */
export async function editIdSet(
  project: ProjectApi,
  itemId: string,
  field: "assignees" | "labels",
  mode: SetMode,
  ids: readonly string[]
): Promise<string[]> {
  let value: string[];

  if (mode === "set") {
    value = [...ids];
  } else if (mode === "clear") {
    value = [];
  } else {
    const item = await project.items.get(itemId);
    const current = new Set(item[field] ?? []);
    for (const id of ids) (mode === "add" ? current.add(id) : current.delete(id));
    value = [...current];
  }

  const updated = await project.items.update(itemId, { [field]: value });
  return updated[field] ?? [];
}

/**
 * The work-item fields shared by `items create`, `items update` and
 * `items subissue create`, with every human-friendly value resolved to a UUID.
 */
export async function workItemFields(project: ProjectApi, args: Args): Promise<Record<string, unknown>> {
  const fields: Record<string, unknown> = {};

  if (args.has("title")) fields.name = args.require("title");
  if (args.has("description-html")) fields.description_html = args.str("description-html") ?? "";
  else if (args.has("description")) fields.description_html = `<p>${args.str("description") ?? ""}</p>`;
  if (args.has("priority")) fields.priority = args.require("priority");
  if (args.has("parent")) fields.parent = args.require("parent");
  if (args.has("state")) fields.state = await project.resolveState(args.require("state"));
  if (args.has("assignee")) fields.assignees = await project.resolveMembers(args.requireList("assignee"));
  if (args.has("label")) fields.labels = await project.resolveLabels(args.requireList("label"));

  return fields;
}

/**
 * The optional field flags shared by every command that writes a work item.
 * `--title` is listed separately because `items create` requires it.
 */
export const ITEM_FIELD_FLAGS =
  "[--description=<text>|--description-html=<html>] [--priority=urgent|high|medium|low|none]\n" +
  "[--state=<name>] [--assignee=<email>[,<email>]] [--label=<name>[,<name>]] [--parent=<item-id>] [--cycle=<name|uuid>]";
