#!/usr/bin/env bash
# macOS installers: a .pkg that puts `plane` in /usr/local/bin, wrapped in a .dmg
# for double-click installation. Requires pkgbuild, productbuild and hdiutil, which
# ship with the Xcode command line tools.
#
# One installer per architecture, deliberately. A universal binary is not an option
# here: `bun build --compile` appends its payload after the Mach-O image, and `lipo`
# neither tolerates that nor preserves it — so a fat build would produce a binary
# that cannot find its own bundle. Two honest installers beat one broken one.
#
#   ./packaging/build-macos.sh                # both architectures
#   ARCH=arm64 ./packaging/build-macos.sh     # just one
set -euo pipefail
export COPYFILE_DISABLE=1   # keep AppleDouble ._ files out of the payload

cd "$(dirname "$0")/.."
. packaging/lib.sh

VERSION="$(plane_version)"
ID="io.github.plane-cli"

for tool in pkgbuild productbuild hdiutil; do
  command -v "$tool" >/dev/null || { echo "$tool not found — macOS with Xcode CLT required." >&2; exit 1; }
done

build_one() {
  local arch="$1" binary="$2" label="$3"
  require_file "$binary"

  local work="build/macos/$arch"
  local root="$work/root"
  rm -rf "$work"
  mkdir -p "$root/usr/local/bin" "$work/dmg" dist

  install -m 0755 "$binary" "$root/usr/local/bin/plane"
  xattr -rc "$root" 2>/dev/null || true              # no xattrs, so no ._ files in the payload
  find "$root" -name '._*' -delete 2>/dev/null || true

  local pkg="dist/plane-macos-${arch}-${VERSION}.pkg"
  pkgbuild --root "$root" --identifier "$ID" --version "$VERSION" \
    --install-location / "$work/component.pkg" >/dev/null
  productbuild --package "$work/component.pkg" "$pkg" >/dev/null
  echo "Built $pkg ($(du -h "$pkg" | cut -f1))"

  cp "$pkg" "$work/dmg/Install plane CLI.pkg"
  cat > "$work/dmg/README.txt" <<EOF
plane ${VERSION} — command-line client for Plane
Built by Mubashir Jamali — https://mubashirjamali.com/en/open-source/plane-cli

This installer is for ${label} Macs.

Double-click "Install plane CLI.pkg" to install the \`plane\` command into
/usr/local/bin, which is already on your PATH. Then open Terminal and run:

    plane --help

It needs no runtime. Configure it with PLANE_API_KEY, PLANE_WORKSPACE and
PLANE_BASE_URL, or a .planerc file — \`plane --help\` shows both.
EOF

  local dmg="dist/plane-macos-${arch}-${VERSION}.dmg"
  rm -f "$dmg"
  hdiutil create -volname "plane CLI ${VERSION}" -srcfolder "$work/dmg" -ov -format UDZO "$dmg" >/dev/null
  echo "Built $dmg ($(du -h "$dmg" | cut -f1))"
}

case "${ARCH:-all}" in
  arm64) build_one arm64 dist/plane-macos-arm64 "Apple Silicon" ;;
  x64)   build_one x64 dist/plane-macos-x64 "Intel" ;;
  all)
    build_one arm64 dist/plane-macos-arm64 "Apple Silicon"
    build_one x64 dist/plane-macos-x64 "Intel"
    ;;
  *) echo "Unsupported ARCH: ${ARCH}. Use arm64, x64 or all." >&2; exit 1 ;;
esac
