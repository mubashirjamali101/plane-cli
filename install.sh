#!/usr/bin/env bash
# plane-cli installer for macOS and Linux.
# Makes the `plane` binary globally available on PATH.
#
#   ./install.sh                 # install from ./dist (after building)
#   curl -fsSL <raw-url>/install.sh | bash   # download + install (set PLANE_DOWNLOAD_BASE)
#
# Env:
#   PLANE_DOWNLOAD_BASE   Base URL hosting the dist binaries (enables curl|bash mode)
#   PREFIX               Override install dir (default: /usr/local/bin, fallback ~/.local/bin)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo "")"

os="$(uname -s)"
arch="$(uname -m)"
case "$os" in
  Darwin) plat="macos" ;;
  Linux)  plat="linux" ;;
  *) echo "Unsupported OS: $os (use install.ps1 on Windows)"; exit 1 ;;
esac
case "$arch" in
  arm64|aarch64) a="arm64" ;;
  x86_64|amd64)  a="x64" ;;
  *) echo "Unsupported arch: $arch"; exit 1 ;;
esac
bin="plane-${plat}-${a}"

# Pick install dir: a writable PATH dir, preferring /usr/local/bin.
choose_dir() {
  if [ -n "${PREFIX:-}" ]; then echo "$PREFIX"; return; fi
  if [ -w /usr/local/bin ] 2>/dev/null; then echo /usr/local/bin; return; fi
  if command -v sudo >/dev/null 2>&1 && [ -d /usr/local/bin ]; then echo /usr/local/bin; return; fi
  echo "$HOME/.local/bin"
}
dest_dir="$(choose_dir)"
dest="$dest_dir/plane"
mkdir -p "$dest_dir" 2>/dev/null || true

tmp=""
src=""
if [ -n "$REPO_DIR" ] && [ -f "$REPO_DIR/dist/$bin" ]; then
  src="$REPO_DIR/dist/$bin"
elif [ -n "$REPO_DIR" ] && [ -f "$REPO_DIR/plane" ] && [ "$plat" = "macos" ]; then
  src="$REPO_DIR/plane"
elif [ -n "${PLANE_DOWNLOAD_BASE:-}" ]; then
  tmp="$(mktemp)"
  echo "Downloading ${PLANE_DOWNLOAD_BASE%/}/$bin ..."
  curl -fsSL "${PLANE_DOWNLOAD_BASE%/}/$bin" -o "$tmp"
  src="$tmp"
else
  echo "Could not find dist/$bin. Build first (./build.sh) or set PLANE_DOWNLOAD_BASE."
  exit 1
fi

install_cmd() { cp "$src" "$dest" && chmod +x "$dest"; }
if ! install_cmd 2>/dev/null; then
  echo "Writing to $dest_dir requires elevated permissions; using sudo."
  sudo cp "$src" "$dest" && sudo chmod +x "$dest"
fi
[ -n "$tmp" ] && rm -f "$tmp"

echo "Installed: $dest"
case ":$PATH:" in
  *":$dest_dir:"*) ;;
  *) echo "NOTE: $dest_dir is not on PATH. Add this to your shell profile:"
     echo "      export PATH=\"$dest_dir:\$PATH\"" ;;
esac

"$dest" --help >/dev/null 2>&1 && echo "Verified: run 'plane --help' to get started." || true
