# Contributing

Thanks for helping out. This is a small, deliberately simple codebase — the bar is that a
newcomer can read a file top to bottom and understand it.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues go
through [private reporting](SECURITY.md), never a public issue.

## Getting set up

Requires [Bun](https://bun.sh) 1.1 or newer.

```bash
bun install
bun test
bun run typecheck
bun run dev -- --help
```

To run against a real instance, put credentials in `~/.planerc` (see the README). Never
commit one.

## Before you open a pull request

```bash
bun test && bun run typecheck && bun run build
```

Both must pass; CI runs the same commands on Linux, macOS and Windows.

## How the code is arranged

Layers depend downward only — `commands` may use `api` and `render`, but never the reverse.

- **`src/api/`** — the REST client. `PlaneApi` scopes down to `api.project(id).item(id)`,
  so handlers never assemble URLs or thread ids through call signatures.
- **`src/cli/`** — `Args` (parsing and validation), `dispatch` (the command tree), `help`.
- **`src/commands/`** — one module per resource. Each command is a plain object with a
  `usage` line, a `summary` and a `run` function.
- **`src/render/`** — all output. Listings go through `printList` so every view shares the
  same shape; no command calls `console.log` directly.
- **`src/config.ts`** — settings resolution. **`src/errors.ts`** — `CliError` and `fail()`.

## Conventions

- **Never call `process.exit` outside `src/index.ts`.** Throw `CliError` (or use `fail()`);
  the entry point turns it into a clean message. Unexpected exceptions keep their stack
  trace, because those are bugs.
- **Validate through `Args`.** Use `args.at(0, "<item-id>")`, `args.require("title")` and
  friends rather than hand-rolled checks — they quote the command's own usage line back to
  the user.
- **Register commands in the tree.** `src/commands/index.ts` is the single source of truth
  for `--help` and every usage message. A new command needs a `usage`, a `summary` and an
  entry in the tree; nothing else.
- **Print through `src/render/`.** New output shapes belong there, not in a command.
- **Comment the why.** Explain surprises — a Plane API quirk, an endpoint that 404s on some
  editions — not what the code plainly says.

## Adding a command

1. Add the command object to the right module in `src/commands/`, or create a new module.
2. Register it in `src/commands/index.ts`.
3. Add a test if it has logic worth testing (parsing, filtering, formatting).
4. Update `CLI_DOCS.md` if the change is user-visible.

## Tests

`bun test` covers the pure logic: argument parsing, settings resolution, HTML and duration
handling, and the command tree's integrity. Anything that talks to the network is kept out
of the test suite; verify those by hand against a real instance.

## Releasing

Bump `version` in `package.json`, commit, then tag it:

```bash
git tag v1.2.3 && git push origin v1.2.3
```

The release workflow verifies the tag matches `package.json`, runs `bun run check`, builds
every binary and installer, and publishes them to a GitHub release.

## Reporting bugs

Open a [bug report](../../issues/new?template=bug_report.yml) — the form asks for the
command you ran, `plane --version`, your platform, and whether the instance is Plane Cloud
or self-hosted. **Redact your API key** from anything you paste; commands, config and error
output can all contain it.
