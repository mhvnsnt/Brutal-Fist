$ErrorActionPreference = "Stop"
git submodule sync --recursive
git submodule update --init --recursive
Write-Host "Schwarzerblitz engine baseline initialized."
Write-Host "Upstream game assets are intentionally excluded; use Bannon/Brutal Fist assets."
