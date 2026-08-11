#!/usr/bin/env bash
# Shared helpers for the packaging scripts. Source this, do not execute it.

# The version every artifact is named after, read from package.json so the
# installers cannot drift from the binary's own `--version`.
plane_version() {
  if [ -n "${VERSION:-}" ]; then
    printf '%s' "$VERSION"
    return
  fi
  sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' package.json | head -1
}

require_file() {
  [ -f "$1" ] || {
    echo "$1 not found. Build the binaries first: ./build.sh" >&2
    exit 1
  }
}

# Create a tarball with root-owned entries and no platform metadata, so the same
# inputs give the same archive on macOS (bsdtar) and Linux (GNU tar).
tar_root_owned() {
  local output="$1" directory="$2"
  shift 2
  if tar --version 2>/dev/null | grep -qi bsdtar; then
    COPYFILE_DISABLE=1 tar --uid 0 --gid 0 --uname root --gname root \
      --no-mac-metadata -czf "$output" -C "$directory" "$@"
  else
    tar --owner=root --group=root --numeric-owner -czf "$output" -C "$directory" "$@"
  fi
}

# md5, however this platform spells it.
md5_of() {
  if command -v md5sum >/dev/null; then md5sum "$1" | cut -d' ' -f1
  else md5 -q "$1"
  fi
}
