param(
    [switch]$NoDocker,
    [switch]$SeedIam
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = Split-Path $PSScriptRoot -Parent
$PlatformRoot = Join-Path $Root 'services\platform'
$PlatformEnv = Join-Path $PlatformRoot '.env'
$WebDistRoot = Join-Path $Root 'services\web-ui\dist'
$RuntimeRoot = Join-Path $Root '.codex\app-runtime'
$LogDir = Join-Path $RuntimeRoot 'logs'
$PidDir = Join-Path $RuntimeRoot 'pids'
$WebServerScript = Join-Path $RuntimeRoot 'serve-web-dist.ps1'
$Node = (Get-Command node -ErrorAction Stop).Source

function Confirm-PathExists {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Message
    )

    if (-not (Test-Path $Path)) {
        throw $Message
    }
}

function Test-HttpReady {
    param([Parameter(Mandatory = $true)][string]$Url)

    try {
        $null = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
        return $true
    } catch {
        return [bool]$_.Exception.Response
    }
}

function Wait-ForHttpReady {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSec = 20
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-HttpReady -Url $Url) {
            return $true
        }
        Start-Sleep -Milliseconds 400
    }

    return $false
}

function Get-ListeningProcess {
    param([Parameter(Mandatory = $true)][int]$Port)

    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if (-not $conn) {
        return $null
    }

    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    return [pscustomobject]@{
        Port        = $Port
        Pid         = $conn.OwningProcess
        ProcessName = if ($proc) { $proc.ProcessName } else { 'unknown' }
    }
}

function Write-StartupFailure {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][int]$Port,
        [Parameter(Mandatory = $true)][string]$StdoutPath,
        [Parameter(Mandatory = $true)][string]$StderrPath
    )

    $listener = Get-ListeningProcess -Port $Port
    if ($listener) {
        Write-Warning "$Name did not start because port $Port is already in use by $($listener.ProcessName) (PID $($listener.Pid))."
    } else {
        Write-Warning "$Name did not become ready on port $Port."
    }

    Write-Warning "Check logs:"
    Write-Warning "  $StdoutPath"
    Write-Warning "  $StderrPath"
}

function Set-WebServerScript {
    $script = @'
param(
    [Parameter(Mandatory = $true)][string]$Root,
    [int]$Port = 5173
)

$ErrorActionPreference = 'Stop'
$prefixes = @(
    "http://localhost:$Port/",
    "http://127.0.0.1:$Port/"
)

$listener = [System.Net.HttpListener]::new()
foreach ($prefix in $prefixes) {
    $listener.Prefixes.Add($prefix)
}

$mime = @{
    '.css'   = 'text/css; charset=utf-8'
    '.html'  = 'text/html; charset=utf-8'
    '.ico'   = 'image/x-icon'
    '.jpeg'  = 'image/jpeg'
    '.jpg'   = 'image/jpeg'
    '.js'    = 'text/javascript; charset=utf-8'
    '.json'  = 'application/json; charset=utf-8'
    '.png'   = 'image/png'
    '.svg'   = 'image/svg+xml'
    '.woff'  = 'font/woff'
    '.woff2' = 'font/woff2'
}

$listener.Start()
Write-Output "web-ui listening on http://localhost:$Port"

while ($listener.IsListening) {
    $context = $listener.GetContext()

    try {
        $path = $context.Request.Url.AbsolutePath
        if ([string]::IsNullOrWhiteSpace($path) -or $path -eq '/') {
            $path = '/index.html'
        }

        $relativePath = $path.TrimStart('/') -replace '/', '\'
        $candidate = Join-Path $Root $relativePath
        $resolvedRoot = [System.IO.Path]::GetFullPath($Root)
        $resolvedFile = [System.IO.Path]::GetFullPath($candidate)

        if (
            -not $resolvedFile.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
            -not (Test-Path $resolvedFile) -or
            (Get-Item $resolvedFile).PSIsContainer
        ) {
            $resolvedFile = Join-Path $Root 'index.html'
        }

        $bytes = [System.IO.File]::ReadAllBytes($resolvedFile)
        $ext = [System.IO.Path]::GetExtension($resolvedFile).ToLowerInvariant()

        $context.Response.StatusCode = 200
        $context.Response.ContentType = if ($mime.ContainsKey($ext)) {
            $mime[$ext]
        } else {
            'application/octet-stream'
        }
        $context.Response.ContentLength64 = $bytes.LongLength
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
        $body = [System.Text.Encoding]::UTF8.GetBytes('Internal Server Error')
        $context.Response.StatusCode = 500
        $context.Response.ContentType = 'text/plain; charset=utf-8'
        $context.Response.ContentLength64 = $body.LongLength
        $context.Response.OutputStream.Write($body, 0, $body.Length)
    } finally {
        $context.Response.OutputStream.Close()
    }
}
'@

    Set-Content -Path $WebServerScript -Value $script -Encoding Ascii
}

function Start-BackendService {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Entry,
        [Parameter(Mandatory = $true)][int]$Port,
        [Parameter(Mandatory = $true)][string]$HealthUrl
    )

    if (Test-HttpReady -Url $HealthUrl) {
        Write-Host "$Name already running on :$Port" -ForegroundColor DarkCyan
        return
    }

    $listener = Get-ListeningProcess -Port $Port
    if ($listener) {
        Write-Warning "$Name not started because port $Port is already in use by $($listener.ProcessName) (PID $($listener.Pid))."
        return
    }

    $stdout = Join-Path $LogDir "$Name.out.log"
    $stderr = Join-Path $LogDir "$Name.err.log"

    Write-Host "Starting $Name on :$Port ..." -ForegroundColor Cyan
    $process = Start-Process -FilePath $Node `
        -ArgumentList $Entry `
        -WorkingDirectory $PlatformRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -PassThru

    Set-Content -Path (Join-Path $PidDir "$Name.pid") -Value $process.Id -Encoding Ascii

    if (Wait-ForHttpReady -Url $HealthUrl) {
        Write-Host "$Name ready on :$Port" -ForegroundColor Green
        return
    }

    Write-StartupFailure -Name $Name -Port $Port -StdoutPath $stdout -StderrPath $stderr
}

function Start-WebUi {
    $url = 'http://localhost:5173/'
    if (Test-HttpReady -Url $url) {
        Write-Host 'web-ui already running on http://localhost:5173' -ForegroundColor DarkCyan
        return
    }

    $listener = Get-ListeningProcess -Port 5173
    if ($listener) {
        Write-Warning "web-ui not started because port 5173 is already in use by $($listener.ProcessName) (PID $($listener.Pid))."
        return
    }

    Set-WebServerScript

    $stdout = Join-Path $LogDir 'web-ui.out.log'
    $stderr = Join-Path $LogDir 'web-ui.err.log'

    Write-Host 'Starting web-ui on http://localhost:5173 ...' -ForegroundColor Cyan
    $process = Start-Process -FilePath 'powershell.exe' `
        -ArgumentList @(
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', $WebServerScript,
            '-Root', $WebDistRoot,
            '-Port', '5173'
        ) `
        -WorkingDirectory $Root `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -PassThru

    Set-Content -Path (Join-Path $PidDir 'web-ui.pid') -Value $process.Id -Encoding Ascii

    if (Wait-ForHttpReady -Url $url -TimeoutSec 10) {
        Write-Host 'web-ui ready on http://localhost:5173' -ForegroundColor Green
        return
    }

    Write-StartupFailure -Name 'web-ui' -Port 5173 -StdoutPath $stdout -StderrPath $stderr
}

Confirm-PathExists -Path $PlatformEnv -Message "Missing $PlatformEnv. Copy services/platform/.env.example to services/platform/.env first."
Confirm-PathExists -Path (Join-Path $PlatformRoot 'dist\apps\api-gateway\main.js') -Message 'Missing platform build for api-gateway. Run: cd services/platform; npm run build'
Confirm-PathExists -Path (Join-Path $PlatformRoot 'dist\apps\user-management\main.js') -Message 'Missing platform build for user-management. Run: cd services/platform; npm run build'
Confirm-PathExists -Path (Join-Path $PlatformRoot 'dist\apps\chat\main.js') -Message 'Missing platform build for chat. Run: cd services/platform; npm run build'
Confirm-PathExists -Path (Join-Path $PlatformRoot 'dist\apps\rbac\main.js') -Message 'Missing platform build for rbac. Run: cd services/platform; npm run build'
Confirm-PathExists -Path (Join-Path $PlatformRoot 'dist\apps\admin-config\main.js') -Message 'Missing platform build for admin-config. Run: cd services/platform; npm run build'
Confirm-PathExists -Path (Join-Path $PlatformRoot 'dist\apps\audit\main.js') -Message 'Missing platform build for audit. Run: cd services/platform; npm run build'
Confirm-PathExists -Path (Join-Path $WebDistRoot 'index.html') -Message 'Missing web-ui build. Run: cd services/web-ui; npm run build'

New-Item -ItemType Directory -Force -Path $RuntimeRoot, $LogDir, $PidDir | Out-Null

if (-not $NoDocker) {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-Host 'Starting postgres + mongodb containers ...' -ForegroundColor Cyan
        Push-Location $Root
        try {
            & docker compose --profile code up -d postgres mongodb
        } finally {
            Pop-Location
        }
    } else {
        Write-Warning 'docker was not found on PATH. Start postgres + mongodb manually if they are not already running.'
    }
}

if ($SeedIam) {
    $seedScript = Join-Path $Root 'scripts\seed-iam.ps1'
    if (Test-Path $seedScript) {
        Write-Host 'Applying IAM seed ...' -ForegroundColor Cyan
        & $seedScript
    } else {
        Write-Warning "Seed script not found: $seedScript"
    }
}

if (-not (Test-HttpReady -Url 'http://localhost:11434/api/tags')) {
    Write-Warning 'Ollama is not reachable at http://localhost:11434. The app can still open, but chat requests may fail until Ollama is running.'
}

Start-BackendService -Name 'user-management' -Entry 'dist/apps/user-management/main.js' -Port 3001 -HealthUrl 'http://localhost:3001/api/auth/health'
Start-BackendService -Name 'chat' -Entry 'dist/apps/chat/main.js' -Port 3002 -HealthUrl 'http://localhost:3002/api/chat/sessions'
Start-BackendService -Name 'rbac' -Entry 'dist/apps/rbac/main.js' -Port 3003 -HealthUrl 'http://localhost:3003/api/rbac/health'
Start-BackendService -Name 'admin-config' -Entry 'dist/apps/admin-config/main.js' -Port 3004 -HealthUrl 'http://localhost:3004/api/admin-config/health'
Start-BackendService -Name 'audit' -Entry 'dist/apps/audit/main.js' -Port 3005 -HealthUrl 'http://localhost:3005/api/audit/health'
Start-BackendService -Name 'api-gateway' -Entry 'dist/apps/api-gateway/main.js' -Port 3000 -HealthUrl 'http://localhost:3000/api/health'
Start-WebUi

Write-Host ''
Write-Host 'App endpoints:' -ForegroundColor Green
Write-Host '  Web UI:         http://localhost:5173'
Write-Host '  API Gateway:    http://localhost:3000/api/health'
Write-Host '  User service:   http://localhost:3001'
Write-Host '  Chat service:   http://localhost:3002'
Write-Host '  RBAC service:   http://localhost:3003/api/rbac/health'
Write-Host '  Admin config:   http://localhost:3004/api/admin-config/health'
Write-Host '  Audit service:  http://localhost:3005/api/audit/health'
Write-Host "  Logs:           $LogDir"
Write-Host ''
Write-Host 'Tip: add -SeedIam if you want the demo login accounts applied before starting.'
