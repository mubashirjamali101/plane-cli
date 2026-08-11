# Installing plane CLI

`plane` is a single self-contained binary — no runtime to install. Pick whichever method fits.
Prebuilt binaries are published on the project's releases page; everything below also works
from a source checkout after `bun run build` or `./build.sh`.

## Quick install (makes `plane` global on PATH)

**macOS / Linux**
```bash
curl -fsSL https://raw.githubusercontent.com/mubashirjamali101/plane-cli/main/install.sh | bash
# or from a source checkout after ./build.sh:
#   ./install.sh
```
Installs to `/usr/local/bin` (falls back to `~/.local/bin`), `chmod +x`, and verifies.
Press Enter if prompted.

**Windows (PowerShell)**
```powershell
irm https://raw.githubusercontent.com/mubashirjamali101/plane-cli/main/install.ps1 | iex
# or:  .\install.ps1
```
Installs `plane.exe` to `%LOCALAPPDATA%\Programs\plane` and adds it to your user PATH.

After installing, configure the three settings and run `plane --help`:
```bash
export PLANE_API_KEY="plane_api_..."
export PLANE_WORKSPACE="your-workspace"
export PLANE_BASE_URL="https://your-plane-instance.example/api/v1"
```
They can live in a `.planerc` file instead — see the [README](README.md#configure).

## Native installers

`./package.sh` produces everything below into `dist/`, alongside a `SHA256SUMS` file.

| Platform | Artifact | How users install |
|----------|----------|-------------------|
| macOS, Apple Silicon | `plane-macos-arm64-<ver>.dmg` (and bare `.pkg`) | Open the `.dmg`, double-click **Install plane CLI.pkg**. Installs `plane` to `/usr/local/bin`. |
| macOS, Intel | `plane-macos-x64-<ver>.dmg` (and bare `.pkg`) | Same. |
| Windows x64 | `plane-windows-<ver>.msi` | Double-click. Per-user install to `%LOCALAPPDATA%\plane`, added to the user PATH — no admin rights needed. |
| Linux, any distro | `plane-<ver>-linux-x86_64.tar.gz`, `…-aarch64.tar.gz` | `tar xzf` and put `plane` on PATH: `sudo install -m 0755 plane /usr/local/bin/`. Ships LICENSE, README and CLI_DOCS. |
| Debian / Ubuntu | `plane-cli_<ver>_amd64.deb`, `…_arm64.deb` | `sudo dpkg -i plane-cli_<ver>_amd64.deb`, or `sudo apt install ./plane-cli_<ver>_amd64.deb`. |
| Linux, portable | `plane-linux-x86_64-<ver>.AppImage`, `…-aarch64-…` | `chmod +x` and run it, or move it onto PATH. |

There is one macOS installer **per architecture**, deliberately: `bun build --compile`
appends its payload after the Mach-O image, which `lipo` neither tolerates nor preserves,
so a universal binary would be silently broken on one of the two architectures.

## Build everything locally (one command)

```bash
./package.sh    # builds all binaries + every installer this machine can produce
```

Every installer can be produced from a single macOS (or Linux) host — no CI, no Windows or Linux box required:
- **macOS `.pkg`/`.dmg`** — `pkgbuild`/`productbuild`/`hdiutil` + a `lipo` universal binary (macOS only).
- **Windows `.msi`** — built with [`msitools`](https://wiki.gnome.org/msitools)' `wixl`, a cross-platform WiX. Produces a genuine Windows Installer database.
- **Linux `.tar.gz` and `.deb`** — need nothing but `tar` and `ar`. The `.deb` is assembled from the format itself (an `ar` archive of `debian-binary`, `control.tar.gz`, `data.tar.gz`), so no `dpkg` is required to build one.
- **Linux `.AppImage`** — an AppImage is just the type-2 runtime ELF with a SquashFS image appended; built with `mksquashfs` + the downloaded runtime (no FUSE, no `appimagetool`, no Linux needed).

Individual builders: `packaging/build-macos.sh`, `packaging/build-msi.sh`, `packaging/build-tarball.sh`, `packaging/build-deb.sh`, `ARCH=x86_64 packaging/build-appimage.sh`. (`packaging/build-windows.ps1` also builds the MSI natively on Windows with the WiX dotnet tool, if you prefer.)

## Prerequisites for building

- **Binaries:** [Bun](https://bun.sh) (`bun build --compile`).
- **macOS pkg/dmg:** Xcode Command Line Tools (`pkgbuild`, `productbuild`, `lipo`, `hdiutil`).
- **Windows MSI:** `brew install msitools` (or `apt-get install wixl`) — provides `wixl`.
- **Linux tarball and .deb:** nothing beyond `tar` and `ar`, both already present.
- **Linux AppImage:** `brew install squashfs` (or `apt-get install squashfs-tools`) — provides `mksquashfs`; plus `curl`.
