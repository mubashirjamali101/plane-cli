# Build the Windows MSI. Run on Windows (or a windows CI runner).
# Requires the WiX v5 dotnet tool:  dotnet tool install --global wix --version 5.0.2
# The MSI installs plane.exe to %LOCALAPPDATA%\plane and adds it to the user PATH (no admin).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$version = if ($env:VERSION) { $env:VERSION } else { "1.0.0" }

if (-not (Test-Path "$root\dist\plane-windows-x64.exe")) {
    throw "dist\plane-windows-x64.exe not found. Run build.sh / bun build first."
}

wix build "$root\packaging\wix\plane.wxs" -arch x64 -bindpath "$root\dist" `
    -o "$root\dist\plane-windows-$version.msi"

Write-Host "Built dist\plane-windows-$version.msi"
