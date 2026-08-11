#!/usr/bin/env bash
# Build a Linux AppImage for plane. Portable: works on Linux AND macOS, because
# an AppImage is just the type-2 runtime ELF with a SquashFS image appended.
# Requires: mksquashfs (squashfs-tools) and curl. No FUSE, no appimagetool, no Linux needed.
#
#   ARCH=x86_64 ./packaging/build-appimage.sh     # default
#   ARCH=aarch64 ./packaging/build-appimage.sh
set -euo pipefail
cd "$(dirname "$0")/.."
. packaging/lib.sh

VERSION="$(plane_version)"
ARCH="${ARCH:-x86_64}"
case "$ARCH" in
  x86_64)  BIN="dist/plane-linux-x64" ;;
  aarch64) BIN="dist/plane-linux-arm64" ;;
  *) echo "Unsupported ARCH: $ARCH"; exit 1 ;;
esac
[ -f "$BIN" ] || { echo "$BIN not found. Build binaries first (./build.sh)."; exit 1; }
command -v mksquashfs >/dev/null || { echo "mksquashfs not found (install squashfs-tools / brew install squashfs)."; exit 1; }

WORK="build/appimage/$ARCH"
APPDIR="$WORK/plane.AppDir"
rm -rf "$WORK"; mkdir -p "$APPDIR/usr/bin"
cp "$BIN" "$APPDIR/usr/bin/plane"; chmod +x "$APPDIR/usr/bin/plane"

cat > "$APPDIR/AppRun" <<'EOF'
#!/bin/sh
HERE="$(dirname "$(readlink -f "$0")")"
exec "$HERE/usr/bin/plane" "$@"
EOF
chmod +x "$APPDIR/AppRun"

cat > "$APPDIR/plane.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=plane
Comment=Plane project management CLI
Exec=plane
Icon=plane
Categories=Utility;Development;
Terminal=true
EOF

# Minimal 1x1 PNG icon (AppImage requires an icon + .DirIcon).
base64 -d > "$APPDIR/plane.png" <<'EOF'
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC
EOF
cp "$APPDIR/plane.png" "$APPDIR/.DirIcon"

# 1) SquashFS image of the AppDir (gzip = universally mountable by the runtime).
SQFS="$WORK/plane.squashfs"
mksquashfs "$APPDIR" "$SQFS" -root-owned -noappend -no-progress -comp gzip -b 131072 >/dev/null

# 2) type-2 runtime ELF for the target arch (embeds the AppImage magic bytes).
RT="build/appimage/runtime-$ARCH"
if [ ! -f "$RT" ]; then
  curl -fsSL "https://github.com/AppImage/type2-runtime/releases/download/continuous/runtime-$ARCH" -o "$RT"
fi

# 3) AppImage = runtime + squashfs, made executable.
OUT="dist/plane-linux-${ARCH}-${VERSION}.AppImage"
cat "$RT" "$SQFS" > "$OUT"
chmod +x "$OUT"
echo "Built $OUT ($(du -h "$OUT" | cut -f1))"
