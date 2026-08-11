#!/usr/bin/env bash
# Distro-agnostic Linux tarballs: a binary, its licence and its docs, in a versioned
# directory. Works on any Linux regardless of package manager — extract and put
# `plane` somewhere on PATH.
#
#   ./packaging/build-tarball.sh              # both architectures
#   ARCH=aarch64 ./packaging/build-tarball.sh # just one
set -euo pipefail
cd "$(dirname "$0")/.."
. packaging/lib.sh

VERSION="$(plane_version)"

build_one() {
  local arch="$1" binary="$2"
  require_file "$binary"

  local name="plane-${VERSION}-linux-${arch}"
  local stage="build/tarball/$name"
  rm -rf "$stage"
  mkdir -p "$stage" dist

  install -m 0755 "$binary" "$stage/plane"
  install -m 0644 LICENSE "$stage/LICENSE"
  install -m 0644 README.md "$stage/README.md"
  install -m 0644 CLI_DOCS.md "$stage/CLI_DOCS.md"

  cat > "$stage/INSTALL.txt" <<EOF
plane ${VERSION} — command-line client for Plane
Built by Mubashir Jamali — https://mubashirjamali.com

Install by putting the binary on your PATH, for example:

    sudo install -m 0755 plane /usr/local/bin/plane

or, without root:

    mkdir -p ~/.local/bin && install -m 0755 plane ~/.local/bin/plane

Then run:

    plane --help

Requires no runtime: the binary is self-contained.
EOF

  tar_root_owned "dist/${name}.tar.gz" "build/tarball" "$name"
  echo "Built dist/${name}.tar.gz ($(du -h "dist/${name}.tar.gz" | cut -f1))"
}

case "${ARCH:-all}" in
  x86_64)  build_one x86_64 dist/plane-linux-x64 ;;
  aarch64) build_one aarch64 dist/plane-linux-arm64 ;;
  all)
    build_one x86_64 dist/plane-linux-x64
    build_one aarch64 dist/plane-linux-arm64
    ;;
  *) echo "Unsupported ARCH: ${ARCH}. Use x86_64, aarch64 or all." >&2; exit 1 ;;
esac
