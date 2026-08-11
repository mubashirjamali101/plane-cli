#!/usr/bin/env bash
# Build the Windows .msi using msitools' `wixl` — a cross-platform WiX that runs
# on macOS and Linux. Produces a real Windows Installer database (per-user install
# of plane.exe to %LOCALAPPDATA%\plane, added to the user PATH).
# Requires: wixl  (brew install msitools  /  apt-get install wixl)
set -euo pipefail
cd "$(dirname "$0")/.."
. packaging/lib.sh

VERSION="$(plane_version)"
command -v wixl >/dev/null || { echo "wixl not found (brew install msitools / apt install wixl)."; exit 1; }
[ -f dist/plane-windows-x64.exe ] || { echo "dist/plane-windows-x64.exe not found. Run ./build.sh first."; exit 1; }

wixl -a x64 -o "dist/plane-windows-${VERSION}.msi" packaging/wix/plane-wixl.wxs
echo "Built dist/plane-windows-${VERSION}.msi"
