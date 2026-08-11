#!/usr/bin/env bash
# Compile `plane` for every supported platform into dist/.
#
# dist/ is wiped first, so what lands there is exactly this run — no stale binaries
# from an earlier version. dist/ is gitignored; nothing here is ever committed.
#
#   ./build.sh            all platforms
#   ./build.sh macos      only targets matching "macos"
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]:-$0}")"

filter="${1:-}"

# target triple -> output filename
targets=(
  "bun-darwin-arm64:plane-macos-arm64"
  "bun-darwin-x64:plane-macos-x64"
  "bun-linux-x64:plane-linux-x64"
  "bun-linux-arm64:plane-linux-arm64"
  "bun-windows-x64:plane-windows-x64.exe"
)

mkdir -p dist
if [ -z "$filter" ]; then
  echo "==> Cleaning dist/"
  rm -rf dist && mkdir -p dist
else
  # A filtered build must not throw away artifacts it was not asked to rebuild.
  echo "==> Rebuilding only targets matching '$filter'"
fi

for entry in "${targets[@]}"; do
  target="${entry%%:*}"
  output="${entry##*:}"
  if [ -n "$filter" ] && [[ "$output" != *"$filter"* ]]; then
    continue
  fi
  echo "==> $output"
  bun build --compile --target="$target" src/index.ts --outfile "dist/$output"
done

# A binary that cannot report its own version is not worth shipping. Only the one
# built for this machine can be executed here.
native="dist/plane-macos-arm64"
case "$(uname -s)-$(uname -m)" in
  Darwin-x86_64) native="dist/plane-macos-x64" ;;
  Linux-x86_64)  native="dist/plane-linux-x64" ;;
  Linux-aarch64) native="dist/plane-linux-arm64" ;;
esac
if [ -x "$native" ]; then
  echo "==> Smoke test: $native --version -> $("$native" --version 2>/dev/null)"
fi

# `bun build --compile` leaves a multi-megabyte cache file in the working directory.
# Left alone these accumulate one per build; sweep them up rather than letting the
# repository quietly grow by 60MB a time.
echo "==> Removing bun compile caches"
rm -f .*.bun-build ./*.bun-build

echo "==> Checksums"
(
  cd dist
  files=$(ls | grep -v '^SHA256SUMS$')
  if command -v sha256sum >/dev/null; then sha256sum $files; else shasum -a 256 $files; fi
) > dist/SHA256SUMS

echo
echo "Built into dist/:"
ls -lh dist/
echo
echo "Install on this machine:  ./install.sh"
