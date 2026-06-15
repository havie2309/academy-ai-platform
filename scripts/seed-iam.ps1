# Apply IAM seed (12-seed-iam.sql) to running pm2_postgres
# Use docker cp to preserve UTF-8. Requires fresh DB or reset IAM tables.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$SqlFile = Join-Path $Root "infra\postgres\init\12-seed-iam.sql"

if (-not (Test-Path $SqlFile)) {
    Write-Error "Missing $SqlFile"
}

$running = docker ps --filter "name=pm2_postgres" --format "{{.Names}}" 2>$null
if (-not $running) {
    Write-Host "pm2_postgres is not running. Start with: .\scripts\up-code.ps1"
    exit 1
}

docker cp $SqlFile pm2_postgres:/tmp/12-seed-iam.sql
docker exec pm2_postgres psql -U pm2_user -d pm2 -f /tmp/12-seed-iam.sql

Write-Host "IAM seed applied. Login: admin / gv001 / hv001 / p2 — password 123456"
