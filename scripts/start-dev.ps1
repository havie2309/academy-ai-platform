& .\scripts\up-code.ps1
docker compose stop user-management     # outdated container, run `npm run start:dev user-management` to start a new one

# Start NestJS services
Start-Process powershell -ArgumentList "-NoExit", "cd services/platform; npm run start:dev api-gateway"
Start-Process powershell -ArgumentList "-NoExit", "cd services/platform; npm run start:dev user-management"
Start-Process powershell -ArgumentList "-NoExit", "cd services/platform; npm run start:dev chat"

# Start AI services
Start-Process powershell -ArgumentList "-NoExit", "cd services/embedding-server; py -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload"
Start-Process powershell -ArgumentList "-NoExit", "cd services/rerank-server; py -m uvicorn main:app --host 0.0.0.0 --port 8002 --reload"
Start-Process powershell -ArgumentList "-NoExit", "cd services/rag-engine; py -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

# ============================================================
# WAIT FOR EMBEDDING SERVER BEFORE STARTING DOCUMENT PROCESSOR
# ============================================================

Write-Host "Waiting for embedding-server to be ready..." -ForegroundColor Yellow

$maxAttempts = 30
$attempt = 0
$ready = $false

while ($attempt -lt $maxAttempts -and -not $ready) {
    $attempt++
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8001/health" -UseBasicParsing -TimeoutSec 4 -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            $ready = $true
            Write-Host "embedding-server is ready! (attempt $attempt)" -ForegroundColor Green
        } else {
            Write-Host "embedding-server returned $($response.StatusCode) (attempt $attempt/$maxAttempts)" -ForegroundColor Yellow
            Start-Sleep -Seconds 1
        }
    } catch {
        Write-Host "embedding-server not responding yet (attempt $attempt/$maxAttempts)" -ForegroundColor Yellow
        Start-Sleep -Seconds 1
    }
}

if (-not $ready) {
    Write-Host "embedding-server did not become ready. Starting document-processor anyway..." -ForegroundColor Red
} else {
    Write-Host "embedding-server confirmed ready, starting document-processor..." -ForegroundColor Green
}

# Start document-processor (now that embedding is ready)
Start-Process powershell -ArgumentList "-NoExit", "cd services/document-processor; py -m uvicorn main:app --host 0.0.0.0 --port 8003 --reload"

# Start Web UI
Start-Process powershell -ArgumentList "-NoExit", "cd services/web-ui; npm run dev"