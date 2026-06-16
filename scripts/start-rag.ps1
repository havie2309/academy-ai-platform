# Start Python RAG services (dev — 3 terminals or run this script)
# Requires: pip install -r requirements.txt in each service folder (first time)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

# Resolve a working Python launcher. The RAG requirements pin old wheels
# (numpy 1.26.4, fastembed 0.4.2, pymilvus 2.4.0, pymupdf 1.24.2) that only
# have prebuilt wheels up to Python 3.12 - so prefer 3.12 explicitly.
function Resolve-Python {
    # 1) py launcher with an explicit 3.12 (works even if the default `py` is newer)
    if (Get-Command py -ErrorAction SilentlyContinue) {
        & py -3.12 --version *> $null
        if ($LASTEXITCODE -eq 0) { return "py -3.12" }
    }
    # 2) a `python` on PATH (assume the user installed 3.12 and ticked "Add to PATH")
    if (Get-Command python -ErrorAction SilentlyContinue) { return "python" }
    # 3) fall back to the default py launcher, but warn it may be too new for the wheels
    if (Get-Command py -ErrorAction SilentlyContinue) {
        Write-Warning "Python 3.12 not found; falling back to default 'py'. If pip install fails on numpy/fastembed/pymupdf, install Python 3.12."
        return "py -3"
    }
    Write-Error "Python not found on PATH. Install Python 3.12 (tick 'Add python.exe to PATH') then reopen PowerShell."
    exit 1
}
$python = Resolve-Python
Write-Host "Using Python launcher: $python"

function Start-RagService {
    param(
        [string]$Name,
        [string]$Dir,
        [int]$Port
    )
    Write-Host "Starting $Name on :$Port ..."
    # Build the venv with the resolved launcher, then call the venv's python by its
    # explicit path. This avoids relying on `python` being on PATH or on Activate.ps1
    # succeeding (it can be blocked by execution policy) - both of which silently
    # skip the install and leave the server unable to start.
    $venvPy = ".\.venv\Scripts\python.exe"
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "cd '$Dir'; if (-not (Test-Path .venv)) { $python -m venv .venv }; & $venvPy -m pip install --upgrade pip; & $venvPy -m pip install -r requirements.txt; & $venvPy -m uvicorn main:app --host 0.0.0.0 --port $Port"
    )
}

Start-RagService -Name "embedding-server" -Dir "$root\services\embedding-server" -Port 8001
Start-Sleep -Seconds 2
Start-RagService -Name "rerank-server" -Dir "$root\services\rerank-server" -Port 8002
Start-Sleep -Seconds 2
Start-RagService -Name "rag-engine" -Dir "$root\services\rag-engine" -Port 8000
Start-Sleep -Seconds 1
Start-RagService -Name "document-processor" -Dir "$root\services\document-processor" -Port 8003

Write-Host ""
Write-Host "RAG services launching in separate windows:"
Write-Host "  embedding-server   http://localhost:8001/health"
Write-Host "  rerank-server      http://localhost:8002/health"
Write-Host "  rag-engine         http://localhost:8000/health"
Write-Host "  document-processor http://localhost:8003/health"
Write-Host ""
Write-Host "Ensure Docker has MongoDB, RabbitMQ, Milvus running:"
Write-Host "  docker compose --profile code up -d mongodb rabbitmq milvus etcd minio"
