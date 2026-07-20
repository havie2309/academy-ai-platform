# start-remote-ai.ps1
# Development launcher for remote AI host (LLM, Embedding, Rerank provided externally).
# Does NOT start local embedding-server, rerank-server, or Ollama.

param(
    [switch]$NoWebUi,
    [switch]$SkipContainers,
    [switch]$SeedIam
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $root "scripts\run-with-log.ps1"

# ---------- Load .env to get remote URLs ----------
function Get-EnvValue {
    param([string]$Key)
    $envPath = Join-Path $root "services\platform\.env"
    if (Test-Path $envPath) {
        $lines = Get-Content $envPath
        foreach ($line in $lines) {
            if ($line -match "^$Key=(.*)$") {
                return $matches[1].Trim()
            }
        }
    }
    return $null
}

$llmUrl = Get-EnvValue -Key "LLM_BASE_URL"
$embedUrl = Get-EnvValue -Key "EMBEDDING_BASE_URL"
$rerankUrl = Get-EnvValue -Key "RERANK_BASE_URL"

if (-not $llmUrl -or -not $embedUrl -or -not $rerankUrl) {
    Write-Warning "Missing remote AI URLs in services/platform/.env"
    Write-Host "Please set: LLM_BASE_URL, EMBEDDING_BASE_URL, RERANK_BASE_URL" -ForegroundColor Yellow
    exit 1
}

Write-Host "Remote AI configuration:" -ForegroundColor Cyan
Write-Host "  LLM:       $llmUrl"
Write-Host "  Embedding: $embedUrl"
Write-Host "  Rerank:    $rerankUrl"

# ---------- Test remote connectivity ----------
function Test-RemoteEndpoint {
    param([string]$Url, [string]$Name)

    # Remove trailing slash and /v1 if present for health check guessing
    $base = $Url -replace '/v1$', ''
    $healthCandidates = @(
        "$base/health",
        "$base/v1/health",
        "$base/api/tags",          # Ollama
        "$Url/health"
    )

    foreach ($candidate in $healthCandidates) {
        try {
            $response = Invoke-WebRequest -Uri $candidate -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Host "  $Name reachable at $candidate" -ForegroundColor Green
                return $true
            } else {
                Write-Host "  $Name returned $($response.StatusCode)" -ForegroundColor Yellow
            }
        } catch {
            # continue trying
        }
    }

    Write-Warning "  $Name not reachable at $Url. Please check IP/port."
    return $false
}

$llmOk = Test-RemoteEndpoint -Url $llmUrl -Name "LLM"
$embedOk = Test-RemoteEndpoint -Url $embedUrl -Name "Embedding"
$rerankOk = Test-RemoteEndpoint -Url $rerankUrl -Name "Rerank"

if (-not ($llmOk -and $embedOk -and $rerankOk)) {
    Write-Warning "Remote services are not all reachable. Starting anyway (may fail later)."
    Read-Host "Press Enter to continue or Ctrl+C to abort"
}

# ---------- Start data containers ----------
if (-not $SkipContainers) {
    Write-Host "Starting data containers..." -ForegroundColor Cyan
    & "$root\scripts\up-code.ps1"

    # Stop the containerized user-management (we run it locally)
    docker compose stop user-management
}

# ---------- Seed IAM if requested ----------
if ($SeedIam) {
    & "$root\scripts\seed-iam.ps1"
}

# ---------- Start NestJS platform services ----------
function Start-NestService {
    param([string]$Name, [int]$Port)
    Write-Host "Starting $Name on: $Port ..."
    $command = "npx nest start $Name --watch"
    $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($command))
    Start-Process powershell -WindowStyle Hidden -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", $runner,
        "-Name", $Name,
        "-WorkingDirectory", "$root\services\platform",
        "-EncodedCommand", $encoded
    )
}

Write-Host "Starting NestJS platform..." -ForegroundColor Cyan
Start-NestService -Name "user-management" -Port 3001
Start-NestService -Name "chat" -Port 3002
Start-NestService -Name "rbac" -Port 3003
Start-NestService -Name "admin-config" -Port 3004
Start-NestService -Name "audit" -Port 3005
Start-NestService -Name "api-gateway" -Port 3000

# ---------- Start Python AI services (ONLY rag-engine and document-processor) ----------
function Start-PythonService {
    param([string]$Path, [string]$Name, [int]$Port)
    Write-Host "Starting $Name on: $Port ..."
    $command = "py -m uvicorn main:app --host 0.0.0.0 --port $Port --reload"
    $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($command))
    Start-Process powershell -WindowStyle Hidden -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", $runner,
        "-Name", $Name,
        "-WorkingDirectory", (Join-Path $root $Path),
        "-EncodedCommand", $encoded
    )
}

Write-Host "Starting local Python services..." -ForegroundColor Cyan
Start-PythonService -Path "services/rag-engine" -Name "rag-engine" -Port 8000
Start-PythonService -Path "services/document-processor" -Name "document-processor" -Port 8003

# ---------- Start Web UI ----------
if (-not $NoWebUi) {
    Write-Host "Starting Web UI..." -ForegroundColor Cyan
    $webCommand = "npm run dev"
    $encodedWeb = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($webCommand))
    Start-Process powershell -WindowStyle Hidden -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", $runner,
        "-Name", "web-ui-dev",
        "-WorkingDirectory", "$root\services\web-ui",
        "-EncodedCommand", $encodedWeb
    )
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "Remote AI Development Stack STARTED" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Remote AI endpoints (from .env):" -ForegroundColor Cyan
Write-Host "    LLM:       $llmUrl"
Write-Host "    Embedding: $embedUrl"
Write-Host "    Rerank:    $rerankUrl"
Write-Host ""
Write-Host "  Local services:" -ForegroundColor Cyan
Write-Host "    API Gateway:    http://localhost:3000/api/health"
Write-Host "    Chat service:   http://localhost:3002"
Write-Host "    User service:   http://localhost:3001"
Write-Host "    RAG Engine:     http://localhost:8000/health"
Write-Host "    Doc Processor:  http://localhost:8003/health"
if (-not $NoWebUi) {
    Write-Host "    Web UI:         http://localhost:5173"
}
Write-Host ""
Write-Host "  Logs are in: $root\runtime-logs\" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  To stop everything: .\scripts\stop-dev.ps1" -ForegroundColor Yellow
Write-Host "================================================================"
