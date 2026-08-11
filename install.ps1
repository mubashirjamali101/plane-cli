# Install plane CLI for Windows in one step.
#
#   irm https://raw.githubusercontent.com/mubashirjamali101/plane-cli/main/install.ps1 | iex
#   .\install.ps1
#
# Press Enter at the prompt to install, or Ctrl-C to cancel.
# Env: PLANE_DOWNLOAD_BASE, PLANE_REPO, PLANE_VERSION, YES=1
$ErrorActionPreference = "Stop"

$Repo = if ($env:PLANE_REPO) { $env:PLANE_REPO } else { "mubashirjamali101/plane-cli" }
$bin = "plane-windows-x64.exe"
$destDir = Join-Path $env:LOCALAPPDATA "Programs\plane"
$dest = Join-Path $destDir "plane.exe"

if (-not $env:YES) {
    Write-Host "Install plane CLI → $dest"
    Read-Host "Press Enter to continue (Ctrl-C to cancel)"
}

New-Item -ItemType Directory -Force -Path $destDir | Out-Null

$repoDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$local = Join-Path $repoDir "dist\$bin"

if (Test-Path $local) {
    Copy-Item $local $dest -Force
} else {
    $base = $env:PLANE_DOWNLOAD_BASE
    if (-not $base) {
        if ($env:PLANE_VERSION) {
            $base = "https://github.com/$Repo/releases/download/$($env:PLANE_VERSION)"
        } else {
            $base = "https://github.com/$Repo/releases/latest/download"
        }
    }
    $url = "$($base.TrimEnd('/'))/$bin"
    Write-Host "Downloading $url …"
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
}

Write-Host "Installed: $dest"

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$destDir*") {
    $newPath = if ($userPath) { "$userPath;$destDir" } else { $destDir }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    $env:Path = "$env:Path;$destDir"
    Write-Host "Added $destDir to your user PATH (open a new terminal to pick it up)."
}

& $dest --version
Write-Host "Done. Try:  plane --help"
