# Build shop + admin for Hostinger static hosting (same UI as localhost).
# Usage:
#   .\scripts\build-hostinger.ps1
#   .\scripts\build-hostinger.ps1 -ShopUrl "https://fancydeals.ug" -AdminUrl "https://admin.fancydeals.ug"
param(
  [string]$ShopUrl = "https://fancydeals.ug",
  [string]$AdminUrl = "https://admin.fancydeals.ug",
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$Luxiva = Split-Path -Parent $PSScriptRoot
$ShopDir = Join-Path $Luxiva "shop-web"
$AdminDir = Join-Path $Luxiva "admin"
$OutRoot = Join-Path $Luxiva "deploy\hostinger\packages"
$ShopOut = Join-Path $OutRoot "shop"
$AdminOut = Join-Path $OutRoot "admin"

function Require-EnvFile($dir, $name) {
  $path = Join-Path $dir $name
  if (-not (Test-Path $path)) {
    throw "Missing $path - copy from .env.example and fill Firebase / Cloudinary values before building."
  }
}

Write-Host "FancyDeals Hostinger build" -ForegroundColor Cyan
Write-Host "  Shop URL : $ShopUrl"
Write-Host "  Admin URL: $AdminUrl"

Require-EnvFile $ShopDir ".env"
Require-EnvFile $AdminDir ".env"

if (-not $SkipInstall) {
  Write-Host "`nInstalling shop-web dependencies..." -ForegroundColor Yellow
  Push-Location $ShopDir
  npm.cmd install
  Pop-Location
  Write-Host "Installing admin dependencies..." -ForegroundColor Yellow
  Push-Location $AdminDir
  npm.cmd install
  Pop-Location
}

$env:VITE_PUBLIC_SITE_URL = $ShopUrl.TrimEnd("/")
$env:PUBLIC_ADMIN_APP_URL = $AdminUrl.TrimEnd("/")

Write-Host "`nBuilding shop-web (production)..." -ForegroundColor Yellow
Push-Location $ShopDir
npm.cmd run build
node scripts/patch-seo-files.mjs
Pop-Location

Write-Host "Building admin (production)..." -ForegroundColor Yellow
Push-Location $AdminDir
npm.cmd run build
Pop-Location

if (-not (Test-Path (Join-Path $ShopDir "dist\index.html"))) {
  throw "shop-web build failed: dist/index.html not found"
}
if (-not (Test-Path (Join-Path $AdminDir "build\index.html"))) {
  throw "admin build failed: build/index.html not found"
}

Write-Host "`nPackaging for upload..." -ForegroundColor Yellow
if (Test-Path $OutRoot) { Remove-Item $OutRoot -Recurse -Force }
New-Item -ItemType Directory -Path $ShopOut -Force | Out-Null
New-Item -ItemType Directory -Path $AdminOut -Force | Out-Null

Copy-Item -Path (Join-Path $ShopDir "dist\*") -Destination $ShopOut -Recurse -Force
Copy-Item -Path (Join-Path $AdminDir "build\*") -Destination $AdminOut -Recurse -Force

$shopZip = Join-Path $OutRoot "fancydeals-shop-upload.zip"
$adminZip = Join-Path $OutRoot "fancydeals-admin-upload.zip"
if (Test-Path $shopZip) { Remove-Item $shopZip -Force }
if (Test-Path $adminZip) { Remove-Item $adminZip -Force }
Compress-Archive -Path (Join-Path $ShopOut "*") -DestinationPath $shopZip -Force
Compress-Archive -Path (Join-Path $AdminOut "*") -DestinationPath $adminZip -Force

Write-Host "`nDone." -ForegroundColor Green
Write-Host "  Shop folder : $ShopOut"
Write-Host "  Admin folder: $AdminOut"
Write-Host "  Shop ZIP    : $shopZip"
Write-Host "  Admin ZIP   : $adminZip"
Write-Host "`nNext: see deploy/hostinger/README.md for Hostinger + Firebase steps."
