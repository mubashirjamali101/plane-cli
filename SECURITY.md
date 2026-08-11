# Security

## Reporting a vulnerability

Please report security issues privately by email to **planecli@mubashirjamali.com**,
rather than opening a public issue. You should get an initial response within a week.
GitHub's [private vulnerability reporting][gh-report] works equally well, if it is enabled
on this repository.

[gh-report]: https://docs.github.com/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability

Please include the version (`plane --version`), what an attacker could achieve, and the
steps to reproduce it. Redact your API key.

## How this tool handles your credentials

`plane` talks to your Plane instance with an API key, so it is worth knowing exactly where
that key can end up.

- **Where the key is read from.** `PLANE_API_KEY`, or an `api_key=` line in a `.planerc`
  (nearest one walking up from the current directory, then `~/.planerc`).
- **Where it is written.** Only to `~/.planerc`, and only when that file does not already
  exist, created with mode `0600`. An existing file is never modified.
- **Where it is sent.** Only to the host in `PLANE_BASE_URL`, as an `x-api-key` header, and
  to the object-storage URL that your own instance hands back for uploads and downloads.
  There is no telemetry and no other network access.
- **Command history.** Every invocation is logged to `.plane/history.jsonl` in the project
  directory. Tokens matching `plane_api_*` and values of `--api-key`/`--token`/`--password`
  are redacted before writing. Other arguments are stored verbatim, so a
  `--message="…"` body is readable by anyone who can read that directory — treat `.plane/`
  as being as sensitive as the tickets it describes, and keep it out of version control
  (the shipped `.gitignore` does).
- **Error output.** API errors include the request URL and the server's response body, but
  never the request headers, so the key is not printed on failure.

## Keeping a checkout safe

- Never commit a `.planerc` containing an `api_key`. Keep credentials in `~/.planerc` and
  let a repository's `.planerc` set only `project` and `default_states`.
- Both `.planerc` and `.plane/` are in this repository's `.gitignore`; add them to any
  project where you use the CLI.
- Prefer an API key scoped to the workspace you actually need, and rotate it in
  Plane → Settings → API tokens if it may have been exposed.
