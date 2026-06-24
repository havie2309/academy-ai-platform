$ErrorActionPreference = "Stop"

Write-Host "Starting profile code..." -ForegroundColor Cyan
docker compose --profile code up -d

if ($LASTEXITCODE -ne 0) {
    $port3001Listener = netstat -ano |
        Select-String ":3001" |
        Select-String "LISTENING" |
        Select-Object -First 1

    if ($port3001Listener) {
        Write-Warning "Port 3001 is already in use. Stop the local service on :3001 (often local user-management) or use Mode A before rerunning up-code.ps1."
    }

    exit $LASTEXITCODE
}

docker compose --profile code ps
