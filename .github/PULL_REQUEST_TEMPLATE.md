<!--
Thanks for contributing. Keep this short — a paragraph and a checklist is plenty.
See CONTRIBUTING.md for the conventions this project follows.
-->

## What this changes

<!-- What it does and why. Link the issue it closes, if there is one. -->

## How you verified it

<!-- The command you ran against a real instance, or the test that now covers it. -->

```console
$ plane ...
```

## Checklist

- [ ] `bun run check` passes (typecheck, tests, and the generated docs are current)
- [ ] New commands are registered in `src/commands/index.ts` with a `usage` and a `summary`
- [ ] `bun run docs` was run if any command, flag or summary changed
- [ ] Output goes through `src/render/`, and errors through `fail()` / `CliError`
- [ ] No API key, ticket content, or internal identifier appears in the diff
