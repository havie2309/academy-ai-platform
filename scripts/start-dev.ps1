& .\scripts\up-code.ps1
docker compose stop user-management     # outdated container, run `npm run start:dev user-management` to start a new one

function Start-NestDevApp {
    param(
        [string]$Name
    )

    Start-Process powershell -WindowStyle Hidden -ArgumentList @(
        '-NoProfile',
        '-Command',
        "cd '$PWD\\services\\platform'; npx nest start $Name --watch"
    )
}

function Start-PythonService {
    param(
        [string]$Path,
        [string]$Command
    )

    Start-Process powershell -WindowStyle Hidden -ArgumentList @(
        '-NoProfile',
        '-Command',
        "cd '$PWD\\$Path'; $Command"
    )
}

# Start NestJS services
Start-NestDevApp -Name 'api-gateway'
Start-NestDevApp -Name 'user-management'
Start-NestDevApp -Name 'chat'
Start-NestDevApp -Name 'rbac'
Start-NestDevApp -Name 'admin-config'
Start-NestDevApp -Name 'audit'

# Start AI services
Start-PythonService -Path 'services/embedding-server' -Command 'py -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload'
Start-PythonService -Path 'services/rerank-server' -Command 'py -m uvicorn main:app --host 0.0.0.0 --port 8002 --reload'
Start-PythonService -Path 'services/rag-engine' -Command 'py -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload'

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
Start-PythonService -Path 'services/document-processor' -Command 'py -m uvicorn main:app --host 0.0.0.0 --port 8003 --reload'

# Start Web UI
Start-Process powershell -WindowStyle Hidden -ArgumentList @(
    '-NoProfile',
    '-Command',
    "cd '$PWD\\services\\web-ui'; npm run dev"
)
