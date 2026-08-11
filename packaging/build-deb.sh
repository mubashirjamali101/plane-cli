#!/usr/bin/env bash
# Debian/Ubuntu packages, built from the .deb format itself rather than with
# dpkg-deb — so this runs on macOS and Linux alike, with no dpkg installed.
#
# A .deb is an `ar` archive of exactly three members, in this order:
#   debian-binary   the format version, "2.0"
#   control.tar.gz  package metadata (./control, ./md5sums)
#   data.tar.gz     the files, laid out from the filesystem root
#
#   ./packaging/build-deb.sh              # both architectures
#   ARCH=arm64 ./packaging/build-deb.sh   # just one
set -euo pipefail
cd "$(dirname "$0")/.."
. packaging/lib.sh

VERSION="$(plane_version)"
MAINTAINER="Mubashir Jamali <planecli@mubashirjamali.com>"
HOMEPAGE="https://mubashirjamali.com/en/open-source/plane-cli"

build_one() {
  local arch="$1" binary="$2"      # arch is the Debian name: amd64 / arm64
  require_file "$binary"

  local work="build/deb/$arch"
  rm -rf "$work"
  mkdir -p "$work/data/usr/bin" "$work/data/usr/share/doc/plane-cli" "$work/control" dist

  install -m 0755 "$binary" "$work/data/usr/bin/plane"
  install -m 0644 LICENSE "$work/data/usr/share/doc/plane-cli/copyright"
  install -m 0644 README.md "$work/data/usr/share/doc/plane-cli/README.md"
  install -m 0644 CLI_DOCS.md "$work/data/usr/share/doc/plane-cli/CLI_DOCS.md"

  # Installed-Size is in kibibytes, rounded up — dpkg shows it before installing.
  local size
  size=$(( ( $(find "$work/data" -type f -exec cat {} + | wc -c) + 1023 ) / 1024 ))

  cat > "$work/control/control" <<EOF
Package: plane-cli
Version: ${VERSION}
Architecture: ${arch}
Maintainer: ${MAINTAINER}
Installed-Size: ${size}
Section: utils
Priority: optional
Homepage: ${HOMEPAGE}
Description: Command-line client for Plane project management
 A single self-contained binary for driving Plane from a terminal, working
 against Plane Cloud and self-hosted instances alike. Lists and edits work
 items, comments, labels, cycles, attachments and worklogs, and ends every
 listing with copy-paste-ready follow-up commands.
 .
 Needs no runtime and no system dependencies.
EOF

  # md5sums lists every shipped file, relative to the filesystem root.
  ( cd "$work/data" && find . -type f | sed 's|^\./||' | sort | while read -r file; do
      printf '%s  %s\n' "$(md5_of "$file")" "$file"
    done ) > "$work/control/md5sums"

  tar_root_owned "$work/data.tar.gz" "$work/data" .
  tar_root_owned "$work/control.tar.gz" "$work/control" .
  printf '2.0\n' > "$work/debian-binary"

  local output="dist/plane-cli_${VERSION}_${arch}.deb"
  rm -f "$output"
  # Members must be added in this order; `ar` is told not to write a symbol index.
  ( cd "$work" && ar -q -c -S "../../../$output" debian-binary control.tar.gz data.tar.gz 2>/dev/null \
      || ar -q -c "../../../$output" debian-binary control.tar.gz data.tar.gz )
  echo "Built $output ($(du -h "$output" | cut -f1))"
}

case "${ARCH:-all}" in
  amd64) build_one amd64 dist/plane-linux-x64 ;;
  arm64) build_one arm64 dist/plane-linux-arm64 ;;
  all)
    build_one amd64 dist/plane-linux-x64
    build_one arm64 dist/plane-linux-arm64
    ;;
  *) echo "Unsupported ARCH: ${ARCH}. Use amd64, arm64 or all." >&2; exit 1 ;;
esac
