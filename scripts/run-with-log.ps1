param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][string]$Command,
    [string]$LogDir = '',
    [switch]$KeepOpen
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not $LogDir) {
    $scriptRoot = Split-Path $PSCommandPath -Parent
    $LogDir = Join-Path (Split-Path $scriptRoot -Parent) '.tmp-startlogs'
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$logPath = Join-Path $LogDir "$Name.log"

function Write-LogLine {
    param(
        [Parameter(Mandatory = $true)][string]$Level,
        [Parameter(Mandatory = $true)][string]$Message
    )

    if ([string]::IsNullOrWhiteSpace($Message)) {
        return
    }

    $timestamp = (Get-Date).ToString('o')
    Add-Content -Path $logPath -Value "$timestamp [$Level] $Message"
}

function Resolve-Level {
    param([Parameter(Mandatory = $true)][string]$Message)

    if ($Message -match '\b(ERROR|CRITICAL|FATAL)\b') { return 'error' }
    if ($Message -match '\b(WARN|WARNING)\b') { return 'warn' }
    if ($Message -match '\b(DEBUG|TRACE)\b') { return 'debug' }
    return 'info'
}

Write-LogLine -Level 'info' -Message "===== starting $Name ====="

Push-Location $WorkingDirectory
try {
    & ([ScriptBlock]::Create($Command)) 2>&1 | ForEach-Object {
        $isErrorRecord = $_ -is [System.Management.Automation.ErrorRecord]
        $text = if ($isErrorRecord) {
            $_.ToString()
        } else {
            [string]$_
        }

        $clean = $text.Trim()
        if (-not $clean) {
            return
        }

        $level = if ($isErrorRecord) {
            'error'
        } else {
            Resolve-Level -Message $clean
        }

        Write-LogLine -Level $level -Message $clean
    }

    $exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }
    Write-LogLine -Level 'info' -Message "===== process exited code=$exitCode ====="
} catch {
    Write-LogLine -Level 'error' -Message ($_.Exception.Message)
    throw
} finally {
    Pop-Location
}

if ($KeepOpen) {
    Write-Host ""
    Write-Host "Log file: $logPath"
    Read-Host "Press Enter to close" | Out-Null
}
