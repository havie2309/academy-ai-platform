param(
    [string]$GatewayUrl = 'http://localhost:3000',
    [string]$UserManagementUrl = 'http://localhost:3001',
    [string]$ChatUrl = 'http://localhost:3002',
    [string]$WebUiUrl = 'http://localhost:5173',
    [string]$OllamaUrl = 'http://localhost:11434/api/tags',
    [switch]$IncludeDocker
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-ResponseBody {
    param([Parameter(Mandatory = $true)]$Response)

    $stream = $Response.GetResponseStream()
    if (-not $stream) {
        return ''
    }

    try {
        $reader = New-Object System.IO.StreamReader($stream)
        try {
            return $reader.ReadToEnd()
        } finally {
            $reader.Dispose()
        }
    } finally {
        $stream.Dispose()
    }
}

function Test-AppEndpoint {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Url,
        [ValidateSet('GET', 'POST')][string]$Method = 'GET',
        [int[]]$AcceptStatuses = @(200),
        [bool]$Required = $true,
        [object]$Body
    )

    $params = @{
        Uri             = $Url
        Method          = $Method
        UseBasicParsing = $true
        TimeoutSec      = 10
    }

    if ($PSBoundParameters.ContainsKey('Body')) {
        $params.ContentType = 'application/json'
        $params.Body = $Body | ConvertTo-Json -Depth 10 -Compress
    }

    try {
        $response = Invoke-WebRequest @params
        $statusCode = [int]$response.StatusCode
        $content = $response.Content
    } catch [System.Net.WebException] {
        if (-not $_.Exception.Response) {
            return [pscustomobject]@{
                Name       = $Name
                Url        = $Url
                Required   = $Required
                Ok         = $false
                StatusCode = ''
                Note       = $_.Exception.Message
            }
        }

        $statusCode = [int]$_.Exception.Response.StatusCode
        $content = Get-ResponseBody -Response $_.Exception.Response
    }

    $note = ''
    if (-not [string]::IsNullOrWhiteSpace($content)) {
        try {
            $json = $content | ConvertFrom-Json
            if ($json.upstream) {
                $note = "userManagement=$($json.upstream.userManagement); chat=$($json.upstream.chat)"
            } elseif ($json.status) {
                $note = "status=$($json.status)"
            } elseif ($json.message) {
                $note = [string]$json.message
            }
        } catch {
            $note = ''
        }
    }

    return [pscustomobject]@{
        Name       = $Name
        Url        = $Url
        Required   = $Required
        Ok         = $AcceptStatuses -contains $statusCode
        StatusCode = $statusCode
        Note       = $note
    }
}

$checks = @(
    (Test-AppEndpoint -Name 'web-ui' -Url "$($WebUiUrl.TrimEnd('/'))/" -AcceptStatuses @(200)),
    (Test-AppEndpoint -Name 'api-gateway' -Url "$($GatewayUrl.TrimEnd('/'))/api/health" -AcceptStatuses @(200)),
    (Test-AppEndpoint -Name 'user-management' -Url "$($UserManagementUrl.TrimEnd('/'))/api/users/me" -AcceptStatuses @(401)),
    (Test-AppEndpoint -Name 'chat' -Url "$($ChatUrl.TrimEnd('/'))/api/chat/sessions" -AcceptStatuses @(401)),
    (Test-AppEndpoint -Name 'ollama' -Url $OllamaUrl -AcceptStatuses @(200) -Required $false)
)

$failedRequiredChecks = @($checks | Where-Object { $_.Required -and -not $_.Ok })

$statusColor = if ($failedRequiredChecks.Count -eq 0) {
    'Green'
} else {
    'Yellow'
}
$statusText = if ($statusColor -eq 'Green') { 'ok' } else { 'degraded' }

Write-Host "App health: $statusText" -ForegroundColor $statusColor
$checks |
    Select-Object Name, Ok, StatusCode, Note, Url |
    Format-Table -AutoSize

if ($IncludeDocker -and (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host ''
    Write-Host 'Docker profile code:' -ForegroundColor Cyan
    Push-Location (Split-Path $PSScriptRoot -Parent)
    try {
        & docker compose --profile code ps
    } catch {
        Write-Warning 'Unable to query docker compose ps from this shell. Run the terminal as Administrator if you need container status here.'
    } finally {
        Pop-Location
    }
}

if ($statusColor -ne 'Green') {
    exit 1
}
