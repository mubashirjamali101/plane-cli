#!/usr/bin/env bash
# Build the binaries and every installer this machine can produce, into dist/.
#
# One macOS (or Linux) host can produce the whole set:
#   macOS    plane-macos-<version>.pkg and .dmg   (macOS host only — needs pkgbuild/hdiutil)
#   Windows  plane-windows-<version>.msi          (wixl, cross-platform)
#   Linux    plane-<version>-linux-<arch>.tar.gz  (always)
#            plane-cli_<version>_<arch>.deb       (always — built from the .deb spec)
#            plane-linux-<arch>-<version>.AppImage (mksquashfs + curl)
set -euo pipefail
cd "$(dirname "$0")"
. packaging/lib.sh

VERSION="$(plane_version)"
echo "==> plane $VERSION — building binaries for all platforms"
./build.sh

os="$(uname -s)"
skipped=()

# macOS .pkg + .dmg need the macOS toolchain (pkgbuild, productbuild, hdiutil, lipo).
if [ "$os" = "Darwin" ]; then
  echo "==> macOS .pkg + .dmg"
  bash packaging/build-macos.sh
else
  skipped+=(".pkg/.dmg (needs a macOS host)")
fi

# Windows .msi via wixl, which runs anywhere.
if command -v wixl >/dev/null 2>&1; then
  echo "==> Windows .msi"
  bash packaging/build-msi.sh
else
  skipped+=(".msi (install msitools: brew install msitools / apt-get install wixl)")
fi

# Linux tarballs and .deb packages need nothing beyond tar and ar.
echo "==> Linux tarballs"
bash packaging/build-tarball.sh

echo "==> Linux .deb packages"
bash packaging/build-deb.sh

# AppImages need mksquashfs plus the downloaded type-2 runtime.
if command -v mksquashfs >/dev/null 2>&1; then
  echo "==> Linux AppImages"
  ARCH=x86_64 bash packaging/build-appimage.sh
  ARCH=aarch64 bash packaging/build-appimage.sh
else
  skipped+=(".AppImage (install squashfs-tools: brew install squashfs / apt-get install squashfs-tools)")
fi

# Checksums cover every artifact, so regenerate now that the installers exist.
echo "==> Checksums"
(
  cd dist
  files=$(ls | grep -v '^SHA256SUMS$')
  if command -v sha256sum >/dev/null; then sha256sum $files; else shasum -a 256 $files; fi
) > dist/SHA256SUMS

echo
echo "Artifacts in dist/:"
ls -lh dist/
if [ ${#skipped[@]} -gt 0 ]; then
  echo
  echo "Skipped on this machine:"
  printf '  - %s\n' "${skipped[@]}"
fi
