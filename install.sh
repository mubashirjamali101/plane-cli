#!/usr/bin/env bash
# Install plane CLI for macOS / Linux in one step.
#
#   curl -fsSL https://raw.githubusercontent.com/mubashirjamali101/plane-cli/main/install.sh | bash
#   ./install.sh                    # from a source checkout (uses ./dist if present)
#
# Press Enter at the prompt to install, or Ctrl-C to cancel.
# Env overrides: PREFIX, PLANE_REPO, PLANE_DOWNLOAD_BASE, PLANE_VERSION, YES=1 (skip prompt)
set -euo pipefail

REPO="${PLANE_REPO:-mubashirjamali101/plane-cli}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo "")"

os="$(uname -s)"
arch="$(uname -m)"
case "$os" in
  Darwin) plat="macos" ;;
  Linux)  plat="linux" ;;
  *) echo "Unsupported OS: $os (on Windows use install.ps1)"; exit 1 ;;
esac
case "$arch" in
  arm64|aarch64) a="arm64" ;;
  x86_64|amd64)  a="x64" ;;
  *) echo "Unsupported arch: $arch"; exit 1 ;;
esac
bin="plane-${plat}-${a}"

choose_dir() {
  if [ -n "${PREFIX:-}" ]; then echo "$PREFIX"; return; fi
  if [ -w /usr/local/bin ] 2>/dev/null; then echo /usr/local/bin; return; fi
  if command -v sudo >/dev/null 2>&1 && [ -d /usr/local/bin ]; then echo /usr/local/bin; return; fi
  echo "$HOME/.local/bin"
}
dest_dir="$(choose_dir)"
dest="$dest_dir/plane"

if [ -z "${YES:-}" ] && [ -t 0 ]; then
  echo "Install plane CLI → $dest"
  printf "Press Enter to continue (Ctrl-C to cancel)… "
  read -r _
elif [ -z "${YES:-}" ] && [ ! -t 0 ]; then
  # Piped install (curl | bash): no TTY to press Enter on — proceed with a clear notice.
  echo "Install plane CLI → $dest"
fi

mkdir -p "$dest_dir" 2>/dev/null || true

tmp=""
src=""
if [ -n "$REPO_DIR" ] && [ -f "$REPO_DIR/dist/$bin" ]; then
  src="$REPO_DIR/dist/$bin"
elif [ -n "$REPO_DIR" ] && [ -f "$REPO_DIR/plane" ] && [ "$plat" = "macos" ]; then
  src="$REPO_DIR/plane"
else
  base="${PLANE_DOWNLOAD_BASE:-}"
  if [ -z "$base" ]; then
    if [ -n "${PLANE_VERSION:-}" ]; then
      base="https://github.com/${REPO}/releases/download/${PLANE_VERSION}"
    else
      base="https://github.com/${REPO}/releases/latest/download"
    fi
  fi
  tmp="$(mktemp)"
  url="${base%/}/$bin"
  echo "Downloading $url …"
  curl -fsSL "$url" -o "$tmp"
  src="$tmp"
fi

install_cmd() { cp "$src" "$dest" && chmod +x "$dest"; }
if ! install_cmd 2>/dev/null; then
  echo "Need elevated permissions for $dest_dir — using sudo."
  sudo cp "$src" "$dest" && sudo chmod +x "$dest"
fi
[ -n "$tmp" ] && rm -f "$tmp"

echo "Installed: $dest"
case ":$PATH:" in
  *":$dest_dir:"*) ;;
  *) echo "NOTE: add to your shell profile:  export PATH=\"$dest_dir:\$PATH\"" ;;
esac

"$dest" --version 2>/dev/null && echo "Done. Try:  plane --help" || true
