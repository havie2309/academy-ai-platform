# Start all NestJS platform services for local dev (6 apps + tips for web-ui / rag)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$platform = Join-Path $root 'services\platform'
$runner = Join-Path $root 'scripts\run-with-log.ps1'

if (-not (Test-Path (Join-Path $platform '.env'))) {
    Write-Error "Missing services/platform/.env — copy from .env.example first."
}

function Start-NestApp {
    param(
        [string]$Name,
        [int]$Port
    )
    Write-Host "Starting $Name on :$Port ..."
    Start-Process powershell -ArgumentList @(
        '-NoExit',
        '-File',
        $runner,
        '-Name',
        $Name,
        '-WorkingDirectory',
        $platform,
        '-Command',
        "npx nest start $Name --watch",
        '-KeepOpen'
    )
    Start-Sleep -Seconds 2
}

Write-Host 'Launching platform services in separate windows:' -ForegroundColor Cyan
Start-NestApp -Name 'user-management' -Port 3001
Start-NestApp -Name 'chat' -Port 3002
Start-NestApp -Name 'rbac' -Port 3003
Start-NestApp -Name 'admin-config' -Port 3004
Start-NestApp -Name 'audit' -Port 3005
Start-NestApp -Name 'api-gateway' -Port 3000

Write-Host ''
Write-Host 'Platform dev stack:' -ForegroundColor Green
Write-Host '  user-management  http://127.0.0.1:3001'
Write-Host '  chat             http://127.0.0.1:3002'
Write-Host '  rbac             http://127.0.0.1:3003/api/rbac/health'
Write-Host '  admin-config     http://127.0.0.1:3004/api/admin-config/health'
Write-Host '  audit            http://127.0.0.1:3005/api/audit/health'
Write-Host '  api-gateway      http://127.0.0.1:3000/api/health'
Write-Host ''
Write-Host 'Also run (separate terminals):' -ForegroundColor Yellow
Write-Host '  cd services/web-ui; npm run dev          # http://127.0.0.1:5174'
Write-Host '  .\scripts\start-rag.ps1                  # rag-engine :8000'
Write-Host ''
Write-Host 'Tip: use 127.0.0.1 (not localhost) for Redis/RabbitMQ in .env on Windows.'
