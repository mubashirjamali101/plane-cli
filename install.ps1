# plane-cli installer for Windows (PowerShell).
# Makes `plane` globally available by installing to a per-user Programs dir and adding it to PATH.
#
#   ./install.ps1                       # install from .\dist
#   iwr -useb <raw-url>/install.ps1 | iex   # set $env:PLANE_DOWNLOAD_BASE first for download mode
#
# Env:
#   PLANE_DOWNLOAD_BASE   Base URL hosting the dist binaries (enables download mode)
$ErrorActionPreference = "Stop"

$bin = "plane-windows-x64.exe"
$destDir = Join-Path $env:LOCALAPPDATA "Programs\plane"
$dest = Join-Path $destDir "plane.exe"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null

$repoDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$src = Join-Path $repoDir "dist\$bin"

if (Test-Path $src) {
    Copy-Item $src $dest -Force
} elseif ($env:PLANE_DOWNLOAD_BASE) {
    $url = "$($env:PLANE_DOWNLOAD_BASE.TrimEnd('/'))/$bin"
    Write-Host "Downloading $url ..."
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
} else {
    throw "Could not find dist\$bin. Build first (.\build.sh) or set `$env:PLANE_DOWNLOAD_BASE."
}

Write-Host "Installed: $dest"

# Add destDir to the user PATH if missing.
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$destDir*") {
    $newPath = if ($userPath) { "$userPath;$destDir" } else { $destDir }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    $env:Path = "$env:Path;$destDir"
    Write-Host "Added $destDir to your user PATH (restart terminals to pick it up)."
}

& $dest --help | Out-Null
Write-Host "Verified: run 'plane --help' to get started."
