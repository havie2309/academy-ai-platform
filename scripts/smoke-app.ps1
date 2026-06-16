param(
    [string]$BaseUrl = 'http://localhost:3000',
    [string]$WebUiUrl = 'http://localhost:5173',
    [string]$Username = 'admin',
    [string]$Password = '123456',
    [switch]$SkipWebUi
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

function Invoke-AppRequest {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('GET', 'POST', 'DELETE')][string]$Method,
        [Parameter(Mandatory = $true)][string]$Url,
        [hashtable]$Headers,
        [object]$Body
    )

    $requestHeaders = @{}
    if ($Headers) {
        foreach ($key in $Headers.Keys) {
            $requestHeaders[$key] = $Headers[$key]
        }
    }

    $params = @{
        Uri             = $Url
        Method          = $Method
        Headers         = $requestHeaders
        UseBasicParsing = $true
        TimeoutSec      = 20
    }

    if ($PSBoundParameters.ContainsKey('Body')) {
        $params.ContentType = 'application/json'
        $params.Body = $Body | ConvertTo-Json -Depth 10 -Compress
    }

    try {
        $response = Invoke-WebRequest @params
    } catch [System.Net.WebException] {
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            $content = Get-ResponseBody -Response $_.Exception.Response
            throw "HTTP $statusCode from $Method $Url`n$content"
        }
        throw
    }

    $json = $null
    if (-not [string]::IsNullOrWhiteSpace($response.Content)) {
        try {
            $json = $response.Content | ConvertFrom-Json
        } catch {
            $json = $null
        }
    }

    return [pscustomobject]@{
        StatusCode = [int]$response.StatusCode
        Json       = $json
        Content    = $response.Content
    }
}

function Test-Assertion {
    param(
        [Parameter(Mandatory = $true)][bool]$Condition,
        [Parameter(Mandatory = $true)][string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "==> $Message" -ForegroundColor Cyan
}

$base = $BaseUrl.TrimEnd('/')
$webRoot = $WebUiUrl.TrimEnd('/')
$token = $null
$sessionId = $null

try {
    if (-not $SkipWebUi) {
        Write-Step 'Checking web-ui root'
        $web = Invoke-AppRequest -Method 'GET' -Url "$webRoot/"
        Test-Assertion -Condition ($web.StatusCode -eq 200) -Message 'web-ui did not return HTTP 200.'
    }

    Write-Step 'Checking gateway health'
    $health = Invoke-AppRequest -Method 'GET' -Url "$base/api/health"
    Test-Assertion -Condition ($health.StatusCode -eq 200) -Message 'Gateway health did not return HTTP 200.'
    Test-Assertion -Condition ($health.Json.upstream.userManagement -eq 'up') -Message 'Gateway upstream user-management is not up.'
    Test-Assertion -Condition ($health.Json.upstream.chat -eq 'up') -Message 'Gateway upstream chat is not up.'

    Write-Step "Logging in as $Username"
    $login = Invoke-AppRequest -Method 'POST' -Url "$base/api/auth/login" -Body @{
        username = $Username
        password = $Password
    }
    $token = [string]$login.Json.access_token
    Test-Assertion -Condition (-not [string]::IsNullOrWhiteSpace($token)) -Message 'Login did not return access_token.'

    $authHeaders = @{ Authorization = "Bearer $token" }

    Write-Step 'Fetching /api/users/me'
    $me = Invoke-AppRequest -Method 'GET' -Url "$base/api/users/me" -Headers $authHeaders
    Test-Assertion -Condition ($me.StatusCode -eq 200) -Message '/api/users/me did not return HTTP 200.'
    Test-Assertion -Condition ([string]$me.Json.username -eq $Username) -Message "/api/users/me returned username '$($me.Json.username)' instead of '$Username'."

    Write-Step 'Listing chat sessions'
    $null = Invoke-AppRequest -Method 'GET' -Url "$base/api/chat/sessions" -Headers $authHeaders

    Write-Step 'Creating a chat session'
    $created = Invoke-AppRequest -Method 'POST' -Url "$base/api/chat/sessions" -Headers $authHeaders -Body @{
        title = "Smoke $(Get-Date -Format 'yyyyMMdd-HHmmss')"
    }
    $sessionId = [string]$created.Json.id
    Test-Assertion -Condition (-not [string]::IsNullOrWhiteSpace($sessionId)) -Message 'Chat session creation did not return an id.'

    Write-Step 'Deleting the smoke chat session'
    $deleted = Invoke-AppRequest -Method 'DELETE' -Url "$base/api/chat/sessions/$sessionId" -Headers $authHeaders
    Test-Assertion -Condition ($deleted.Json.deleted -eq $true) -Message 'Chat session delete did not return deleted=true.'
    $sessionId = $null

    Write-Step 'Logging out'
    $logout = Invoke-AppRequest -Method 'POST' -Url "$base/api/auth/logout" -Headers $authHeaders
    Test-Assertion -Condition (@(200, 201) -contains $logout.StatusCode) -Message "Logout returned HTTP $($logout.StatusCode) instead of 200/201."
    $token = $null

    Write-Host ''
    Write-Host 'Smoke test PASS' -ForegroundColor Green
    Write-Host "  Gateway:  $base/api/health"
    if (-not $SkipWebUi) {
        Write-Host "  Web UI:   $webRoot/"
    }
    Write-Host "  Login:    $Username"
    Write-Host '  Checks:   health, login, /users/me, /chat/sessions create+delete, logout'
} catch {
    Write-Host ''
    Write-Host 'Smoke test FAIL' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    if ($sessionId -and $token) {
        try {
            Invoke-AppRequest -Method 'DELETE' -Url "$base/api/chat/sessions/$sessionId" -Headers @{ Authorization = "Bearer $token" } | Out-Null
        } catch {
        }
    }
}
