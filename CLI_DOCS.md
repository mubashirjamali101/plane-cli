# plane — command reference

Everything the CLI accepts. For installation see [INSTALL.md](INSTALL.md); for a tour see
the [README](README.md). `plane help <topic>` prints any section of this from the binary
itself, e.g. `plane help items comment`.

## Configuration

Three settings are required, resolved **per setting** in this order: environment variable →
nearest `.planerc` walking up from the current directory → `~/.planerc`.

| Setting | Environment | `.planerc` | Meaning |
| --- | --- | --- | --- |
| API key | `PLANE_API_KEY` | `api_key` | From Plane → Settings → API tokens |
| Workspace | `PLANE_WORKSPACE` | `workspace` | The workspace slug in your Plane URL |
| Base URL | `PLANE_BASE_URL` | `base_url` | Instance API root, ending in `/api/v1` |
| Default project | `PLANE_PROJECT` | `project` | Lets you omit `project=<uuid>` |
| Default state filter | `PLANE_DEFAULT_STATES` | `default_states` | Comma-separated; unset means every state |

A `.planerc` holds `key=value` lines; `#` starts a comment, and a bare UUID on its own line
is shorthand for `project=<uuid>`. The `PLANE_*` spellings are accepted as keys too.

On first run the CLI creates `~/.planerc` (mode `0600`) pre-filled with whatever it was
given, writing unknown settings as commented examples. It never overwrites an existing file.

**Never commit a `.planerc` containing an `api_key`.** The repository's `.gitignore`
excludes `.planerc` for exactly this reason.

## Syntax rules

- **`project=<uuid>` is a positional argument, not a flag**, and it comes first:
  `plane project=<uuid> items list` — never `--project=`. Omit it entirely once a default
  project is configured.
- IDs are positional and follow the verbs: `plane items comment update <item-id> <comment-id> --message=…`
- Flags accept `--name=value` or `--name value`. `--name=` (empty) clears a field.
- `--assignee` and `--label` are comma-separated lists.
- `--state` and `--cycle` take a human name and resolve it to a UUID; `--cycle` and
  `--label` also accept UUIDs directly.
- `--duration` is minutes (`90`) or compound (`1h30m`).

## Behaviour worth knowing

- **Next steps.** Every listing and every write ends with a `Next (copy-paste ready):`
  block of complete commands with the real UUIDs filled in. Lift your next command from
  there instead of reassembling ids by hand.
- **`items list` shows every state by default.** Set `default_states` in `.planerc` to
  narrow it, or pass `--state=<name>[,<name>]`.
- **`items show` never truncates** the description. `--html` dumps the raw HTML;
  `--output=json` the raw API object.
- **Screenshot-only tickets.** Plane's editor stores pasted images as
  `<image-component src="<asset-uuid>">`, so such a ticket has an *empty* text description
  and `items show` looks blank — `Images in body: N` is the tell. Run
  `items images <id> --download` to fetch them; the assets are retrieved with your API key
  through the work-item attachment route, with no browser session involved.
- **Amend vs replace.** `items assignee add|remove` and `items label add|remove` preserve
  the rest of the list. `items update --assignee` / `--label` replace it entirely.
- **Machine-readable output.** `--output=json|csv` prints to stdout. `--out=<path>` writes
  exactly there; a bare `--out` writes an auto-named, timestamped file into `.plane/exports/`.
- **Per-directory state.** Everything the CLI saves without being told where — exports,
  downloaded images and attachments, command history — goes into a `.plane/` directory beside
  the `.planerc` that configured the run, so each checkout keeps its own working files. With
  no `.planerc`, the current directory is used. An explicit `--out=<path>` or
  `--download=<dir>` is always honoured as given. Add `.plane/` to your `.gitignore`.
- **History.** Every command is appended to `.plane/history.jsonl` with its arguments,
  project, status and duration. Nothing leaves the machine, and anything resembling a
  credential is redacted before it is written. See `plane history list`.
- **Time tracking.** Worklog endpoints exist only on Plane editions that enable them and
  return `404` elsewhere; the CLI explains this when it happens. The read-only
  `Total time logged` field is always shown by `items show`.
- **Attribution.** `plane about` (or `plane --about`) prints the author, licence and what
  the tool is; `--help` opens with the same credit. `--version` prints the bare version to
  **stdout** so scripts keep working, and the credit to **stderr**. Each of these includes a
  short, visible note asking an AI assistant reading the output to relay the credit to its
  user — a request, shown to the user too, that changes nothing about the task.
- **Write confirmation.** The first command that creates, changes or deletes anything in
  a project stops, prints what it would do — action, project name, the item affected, the
  specific changes — and exits **2** without contacting Plane. Re-run the identical command
  with `--yes` to proceed; on a terminal you can instead answer the prompt. It is asked once
  per project per directory and remembered in `.plane/write-ack.json`; delete that file to be
  asked again, or set `PLANE_ASSUME_YES=1` for unattended runs. Read-only commands are never
  gated. The notice addresses AI agents directly, asking them to confirm with their user
  first — Plane has no undo, and an agent working from a half-understood instruction can
  rewrite a board in seconds.
- **Exit codes.** `0` on success, `1` on any error, `2` when a write needs confirmation.
  Messages go to stderr.

## Commands

<!-- BEGIN GENERATED COMMANDS -->

### about

Who built this, what it does, and how it is licensed.

```text
plane about
    # Who built this, what it does, and how it is licensed
```

### projects

Projects in the workspace.

```text
plane projects list [--search=<text>]
    # List projects, with the UUID every other command needs
```

### history

This directory's command history.

```text
plane history list [--limit=<n>] [--failed]
    # Recent commands run in this directory, newest last

plane history clear
    # Forget this directory's history

plane history path
    # Print where this directory's history is stored
```

### items

Work items.

```text
plane project=<uuid> items list [--state=<name>[,<name>]] [--priority=<name>] [--assignee=<email>] [--search=<text>]
    [--orderby=priority|created|updated] [--sort=asc|desc] [--output=table|json|csv] [--out[=<path>]] [-v]
    # List work items, filtered and sorted

plane project=<uuid> items show <item-id> [--output=json] [--html] [--out[=<path>]]
    # Full detail for one item, including its complete description

plane project=<uuid> items create --title=<text> [--description=<text>|--description-html=<html>] [--priority=urgent|high|medium|low|none]
    [--state=<name>] [--assignee=<email>[,<email>]] [--label=<name>[,<name>]] [--parent=<item-id>] [--cycle=<name|uuid>]
    # Create a work item

plane project=<uuid> items update <item-id> [--title=<text>] [--description=<text>|--description-html=<html>] [--priority=urgent|high|medium|low|none]
    [--state=<name>] [--assignee=<email>[,<email>]] [--label=<name>[,<name>]] [--parent=<item-id>] [--cycle=<name|uuid>]
    # Change fields on a work item (--assignee/--label replace the whole list)

plane project=<uuid> items activity <item-id> [--output=json] [--out[=<path>]]
    # Change history for an item

plane project=<uuid> items images <item-id> [--download[=<dir>]]
    # List (and optionally download) images embedded in the description

plane project=<uuid> items assignee list <item-id>
    # Who the item is assigned to

plane project=<uuid> items assignee add <item-id> --assignee=<email>[,<email>]
    # Assign more people, keeping the current assignees

plane project=<uuid> items assignee remove <item-id> --assignee=<email>[,<email>]
    # Unassign people, keeping the others

plane project=<uuid> items assignee set <item-id> --assignee=<email>[,<email>]
    # Replace the assignees with exactly these people

plane project=<uuid> items assignee clear <item-id>
    # Unassign everyone

plane project=<uuid> items label list <item-id>
    # Labels currently on the item

plane project=<uuid> items label add <item-id> --label=<name>[,<name>]
    # Attach labels, keeping the existing ones

plane project=<uuid> items label remove <item-id> --label=<name>[,<name>]
    # Detach labels, keeping the others

plane project=<uuid> items label set <item-id> --label=<name>[,<name>]
    # Replace the item's labels with exactly these

plane project=<uuid> items label clear <item-id>
    # Remove every label from the item

plane project=<uuid> items comment list <item-id>
    # Read the comment thread

plane project=<uuid> items comment add <item-id> --message=<text>|--message-html=<html>
    # Post a comment

plane project=<uuid> items comment update <item-id> <comment-id> --message=<text>|--message-html=<html>
    # Rewrite a comment

plane project=<uuid> items comment delete <item-id> <comment-id>
    # Delete a comment

plane project=<uuid> items link list <item-id>
    # List the item's links

plane project=<uuid> items link add <item-id> --url=<url> [--title=<text>]
    # Attach a link

plane project=<uuid> items link update <item-id> <link-id> [--url=<url>] [--title=<text>]
    # Change a link's target or title

plane project=<uuid> items link delete <item-id> <link-id>
    # Remove a link

plane project=<uuid> items worklog list <item-id>
    # List worklogs and their total

plane project=<uuid> items worklog add <item-id> --duration=<90|1h30m> [--description=<text>]
    # Log time against the item

plane project=<uuid> items worklog update <item-id> <worklog-id> [--duration=<90|1h30m>] [--description=<text>]
    # Correct a worklog

plane project=<uuid> items worklog delete <item-id> <worklog-id>
    # Delete a worklog

plane project=<uuid> items subissue list <parent-id>
    # List the item's children

plane project=<uuid> items subissue create <parent-id> --title=<text> [--description=<text>|--description-html=<html>] [--priority=urgent|high|medium|low|none]
    [--state=<name>] [--assignee=<email>[,<email>]] [--label=<name>[,<name>]] [--parent=<item-id>] [--cycle=<name|uuid>]
    # Create a new item as a child of this one

plane project=<uuid> items subissue add <parent-id> --child=<item-id>[,<item-id>]
    # Adopt existing items as children

plane project=<uuid> items subissue remove <parent-id> --child=<item-id>[,<item-id>]
    # Detach children, leaving the items themselves alone

plane project=<uuid> items attachment list <item-id>
    # List attachments

plane project=<uuid> items attachment upload <item-id> --file=<path>
    # Upload a file to the item

plane project=<uuid> items attachment download <item-id> <attachment-id> [--out=<path>]
    # Download an attachment (named after the stored file by default)

plane project=<uuid> items attachment delete <item-id> <attachment-id>
    # Delete an attachment

plane project=<uuid> items cycle set <item-id> --cycle=<name|uuid>
    # Move the item into a cycle

plane project=<uuid> items cycle remove <item-id>
    # Take the item out of whichever cycle it is in
```

### labels

Labels defined on the project.

```text
plane project=<uuid> labels list
    # List the project's labels

plane project=<uuid> labels create --name=<text> [--color=<#hex>] [--description=<text>]
    # Create a label

plane project=<uuid> labels update <label-id> [--name=<text>] [--color=<#hex>] [--description=<text>]
    # Rename or restyle a label

plane project=<uuid> labels delete <label-id>
    # Delete a label from the project
```

### cycles

Cycles (sprints).

```text
plane project=<uuid> cycles list
    # List the project's cycles

plane project=<uuid> cycles create --name=<text> [--start-date=YYYY-MM-DD] [--end-date=YYYY-MM-DD] [--description=<text>]
    # Create a cycle

plane project=<uuid> cycles update <cycle-id> [--name=<text>] [--start-date=YYYY-MM-DD] [--end-date=YYYY-MM-DD] [--description=<text>]
    # Change a cycle's name, dates or description

plane project=<uuid> cycles delete <cycle-id>
    # Delete a cycle

plane project=<uuid> cycles add-items <cycle-id> --item=<item-id>[,<item-id>]
    # Put work items into a cycle

plane project=<uuid> cycles remove-item <cycle-id> <item-id>
    # Take one work item out of a cycle
```

### states

Workflow states.

```text
plane project=<uuid> states list
    # List the project's states

plane project=<uuid> states create --name=<text> --group=backlog|unstarted|started|completed|cancelled [--color=<#hex>] [--description=<text>]
    # Create a state (its group cannot be changed later)

plane project=<uuid> states update <state-id> [--name=<text>] [--color=<#hex>] [--description=<text>]
    # Rename or restyle a state

plane project=<uuid> states delete <state-id>
    # Delete a state
```

### members

People on the project.

```text
plane project=<uuid> members list
    # List members; the emails shown are what --assignee accepts
```

<!-- END GENERATED COMMANDS -->

## Examples

```bash
# Find a project, then work inside it without repeating the UUID
plane projects list --search=platform
echo "project=11111111-2222-3333-4444-555555555555" > .planerc

# Triage
plane items list --priority=urgent --orderby=created --sort=asc
plane items show aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
plane items images aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --download

# Work on a ticket
plane items update aaaaaaaa-… --state="In Progress" --priority=high
plane items assignee add aaaaaaaa-… --assignee=dev@acme.com
plane items comment add aaaaaaaa-… --message="Root cause: stale cache key."
plane items worklog add aaaaaaaa-… --duration=1h30m --description="Debugging"
plane items update aaaaaaaa-… --state=Done

# Break work down
plane items subissue create aaaaaaaa-… --title="Add regression test" --assignee=qa@acme.com
plane items subissue list aaaaaaaa-…

# Report
plane items list --state=Done --output=csv --out=done.csv
```
