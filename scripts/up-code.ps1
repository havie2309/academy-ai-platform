Write-Host "Starting profile code..." -ForegroundColor Cyan
docker compose --profile code up -d
docker compose --profile code ps