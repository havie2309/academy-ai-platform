param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [string]$Command = '',
    [string]$EncodedCommand = '',
    [string]$LogDir = '',
    [switch]$KeepOpen
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not $LogDir) {
    $scriptRoot = Split-Path $PSCommandPath -Parent
    $LogDir = Join-Path (Split-Path $scriptRoot -Parent) 'runtime-logs'
}

$commandText = ''
if (-not [string]::IsNullOrWhiteSpace($EncodedCommand)) {
    $commandBytes = [Convert]::FromBase64String($EncodedCommand)
    $commandText = [System.Text.Encoding]::Unicode.GetString($commandBytes)
} else {
    $commandText = $Command
}

if ([string]::IsNullOrWhiteSpace($commandText)) {
    throw 'Command cannot be empty.'
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

function Write-ConsoleLine {
    param(
        [Parameter(Mandatory = $true)][string]$Level,
        [Parameter(Mandatory = $true)][string]$Message
    )

    $color = switch ($Level) {
        'error' { 'Red' }
        'warn' { 'Yellow' }
        'debug' { 'DarkGray' }
        default { 'Gray' }
    }

    Write-Host $Message -ForegroundColor $color
}

function Resolve-Level {
    param([Parameter(Mandatory = $true)][string]$Message)

    if ($Message -eq 'System.Management.Automation.RemoteException') { return 'ignore' }
    if ($Message -match '^Fetching \d+ files:') { return 'info' }
    if ($Message -match 'Traceback') { return 'error' }
    if ($Message -match '(^|[^A-Za-z])(ERROR|CRITICAL|FATAL|ERR)([^A-Za-z]|$)') { return 'error' }
    if ($Message -match '\b[A-Za-z]+Warning:') { return 'warn' }
    if ($Message -match '(^|[^A-Za-z])(WARN|WARNING)([^A-Za-z]|$)') { return 'warn' }
    if ($Message -match '(^|[^A-Za-z])(DEBUG|TRACE)([^A-Za-z]|$)') { return 'debug' }
    if ($Message -match '(^|[^A-Za-z])(INFO|LOG|VERBOSE)([^A-Za-z]|$)') { return 'info' }
    return ''
}

function Test-ContinuationLine {
    param([Parameter(Mandatory = $true)][string]$Message)

    return (
        $Message -match '^File ".*", line \d+, in ' -or
        $Message -match '^\^+$' -or
        $Message -match '^from\s+\S+\s+import\s+.+' -or
        $Message -match '^(return\s+await\s+.+|stmt\s*=.+|statement\s*=.+)$'
    )
}

Write-LogLine -Level 'info' -Message "===== starting $Name ====="
Write-ConsoleLine -Level 'info' -Message "===== starting $Name ====="

Push-Location $WorkingDirectory
try {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $lastLevel = 'info'
    try {
        & ([ScriptBlock]::Create($commandText)) 2>&1 | ForEach-Object {
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

            $levelHint = Resolve-Level -Message $clean
            if ($levelHint -eq 'ignore') {
                return
            }

            if (-not [string]::IsNullOrWhiteSpace($levelHint)) {
                $level = $levelHint
            } elseif ((Test-ContinuationLine -Message $clean) -and $lastLevel -in @('warn', 'error')) {
                $level = $lastLevel
            } elseif ($isErrorRecord) {
                $level = 'error'
            } else {
                $level = 'info'
            }

            Write-LogLine -Level $level -Message $clean
            Write-ConsoleLine -Level $level -Message $clean
            $lastLevel = $level
        }
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    $exitCodeVar = Get-Variable -Name LASTEXITCODE -ErrorAction SilentlyContinue
    $exitCode = if ($null -ne $exitCodeVar) { [int]$exitCodeVar.Value } else { 0 }
    Write-LogLine -Level 'info' -Message "===== process exited code=$exitCode ====="
    Write-ConsoleLine -Level 'info' -Message "===== process exited code=$exitCode ====="
} catch {
    Write-LogLine -Level 'error' -Message ($_.Exception.Message)
    Write-ConsoleLine -Level 'error' -Message ($_.Exception.Message)
    throw
} finally {
    Pop-Location
}

if ($KeepOpen) {
    Write-Host ""
    Write-Host "Log file: $logPath"
    Read-Host "Press Enter to close" | Out-Null
}
