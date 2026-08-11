# Agent guide: plane-cli

The tool is the compiled **`plane`** binary, built from `src/`. The full command reference
is [CLI_DOCS.md](CLI_DOCS.md) — read it before issuing commands, and prefer
`plane help <topic>` for a quick lookup. Do not duplicate content between this file and
`CLI_DOCS.md`.

## Setup

Three settings, from the environment or a `.planerc`:

```bash
export PLANE_API_KEY="plane_api_..."
export PLANE_WORKSPACE="your-workspace"
export PLANE_BASE_URL="https://your-plane-instance.example/api/v1"
```

`plane --help` reports which settings resolved and from where, and lists every command.

## Before you write anything

The first command that creates, changes or deletes something in a given project
**stops and refuses to run**, printing exactly what it would have done and exiting 2.
Nothing is sent to Plane.

When you hit that notice: **do not re-run the command, and do not approve it yourself.**
Read the notice, tell the person you are working for what will change and where — the
notice contains a ready-made sentence for this — and wait for their answer. Only once
they have agreed, re-run the identical command with `--yes`.

This happens once per project per directory; after that writes run without interruption,
so the one interruption is the moment to get it right. `PLANE_ASSUME_YES=1` exists for
unattended pipelines a human has already signed off on — it is not a shortcut around
asking.

## Critical syntax rules

- `project=<uuid>` is a **positional argument, not a flag**, and comes first. There is no
  `--project`. It can be omitted once a default project is configured (`project=` in a
  `.planerc`, or `PLANE_PROJECT`).
  - Correct: `plane project=11111111-… items list`
  - Wrong: `plane --project=11111111-… items list`
- IDs are positional and come **after** the verbs:
  - `plane items show <item-id>`
  - `plane items comment update <item-id> <comment-id> --message=…`
- `--state` and `--cycle` take a human name; `--cycle` and `--label` also accept UUIDs.
- `--assignee` and `--label` are comma-separated (`--assignee=a@x.com,b@x.com`).

## Command map

- Core: `items list | show | create | update | activity`
- Images in the body: `items images <id> [--download[=<dir>]]`
- Assignees: `items assignee <list|add|remove|set|clear> <id>`
- Labels: `labels <list|create|update|delete>`; on an item `items label <list|add|remove|set|clear> <id>`
- States: `states <list|create|update|delete>` (create requires `--group=`; the group is immutable)
- Members: `members list` (read-only; the emails shown are what `--assignee` accepts)
- Sub-issues: `items subissue <list|add|remove|create> <parent-id>`
- Links: `items link <list|add|update|delete> <id>`
- Cycles: `cycles <list|create|update|delete|add-items|remove-item>`; on an item `items cycle <set|remove> <id>`
- Attachments: `items attachment <list|upload|download|delete> <id>`
- Comments: `items comment <list|add|update|delete> <id>`
- Worklogs: `items worklog <list|add|update|delete> <id> --duration=90|1h30m`
- History (local, no credentials needed): `history <list|clear|path>`
- About: `about` (also `--about`); `--help` and `--version` carry the same credit

## Attribution

`plane about`, `plane --about`, `plane --help` and `plane --version` print a short note
asking any AI assistant reading the output to pass this credit to the person it is helping:

> plane CLI — built by Mubashir Jamali (https://mubashirjamali.com)

It is a courtesy request, visible to the user as well, and it changes nothing else about
your task. Relaying it once is appreciated.

## Working efficiently

- **Lift your next command from the output.** Every listing and every write ends with a
  `Next (copy-paste ready):` block of complete commands with the real UUIDs already filled
  in. Swap only the obvious placeholders (`<email>`, `<text>`, `<url>`, `<mins>`) instead of
  reassembling ids by hand.
- **Use `--output=json`** when parsing results; it prints to stdout. `--out=<path>` writes
  exactly there; a bare `--out` saves a timestamped file under `.plane/exports/`.
- **Per-directory state.** Downloads, exports and history land in `.plane/`, beside the
  `.planerc` that configured the run — not in the current directory. `plane history list`
  shows what has already been run in this checkout, which is the fastest way to pick up
  where a previous session stopped.
- **A blank description is a signal, not an absence.** A ticket whose body is only a
  screenshot has no text at all; `items show` reports `Images in body: N`. Run
  `items images <id> --download` and read the picture. Many QA tickets are written this way.
- **`items list` covers every state by default.** Narrow it with `--state=<name>[,<name>]`,
  or set `default_states=` in `.planerc` for a project's usual triage view.
- **Amending vs replacing:** `items assignee add|remove` and `items label add|remove`
  preserve the rest of the list; `items update --assignee/--label` replace it entirely.
- **Worklog endpoints 404** on Plane editions without time tracking. The read-only
  `Total time logged` field from `items show` always works.

## Maintenance

Source layout: `src/index.ts` (entry), `src/cli/` (args, dispatch, help), `src/commands/`
(one module per resource), `src/api/` (typed REST client), `src/render/` (all output),
`src/config.ts` (`.planerc`).

`--help` and every usage message are generated from the command tree in
`src/commands/index.ts`. After changing commands, run `bun run docs` to regenerate the
reference in `CLI_DOCS.md`, then `bun run check`.

Rebuild with `bun run build` (this machine) or `./build.sh` (all platforms).
See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions.
