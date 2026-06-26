param(
    [string]$BaseUrl = 'http://localhost:3000',
    [string]$WebUiUrl = 'http://localhost:5173',
    [string]$Username = 'admin',
    [string]$Password = '123456',
    [string]$LimitedUsername = '676156',
    [string]$LimitedPassword = '123456',
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

function Convert-JsonSafe {
    param([string]$Content)

    if ([string]::IsNullOrWhiteSpace($Content)) {
        return $null
    }

    try {
        return $Content | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Invoke-AppRequest {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('GET', 'POST', 'PUT', 'DELETE')][string]$Method,
        [Parameter(Mandatory = $true)][string]$Url,
        [hashtable]$Headers,
        [object]$Body,
        [int[]]$AllowedStatusCodes = @()
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
        $content = $response.Content
        return [pscustomobject]@{
            StatusCode = [int]$response.StatusCode
            Json       = Convert-JsonSafe -Content $content
            Content    = $content
        }
    } catch [System.Net.WebException] {
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            $content = Get-ResponseBody -Response $_.Exception.Response
            if ($AllowedStatusCodes -contains $statusCode) {
                return [pscustomobject]@{
                    StatusCode = $statusCode
                    Json       = Convert-JsonSafe -Content $content
                    Content    = $content
                }
            }
            throw "HTTP $statusCode from $Method $Url`n$content"
        }
        throw
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
$limitedToken = $null
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
    Test-Assertion -Condition ($health.Json.upstream.rbac -eq 'up') -Message 'Gateway upstream rbac is not up.'
    Test-Assertion -Condition ($health.Json.upstream.adminConfig -eq 'up') -Message 'Gateway upstream admin-config is not up.'
    Test-Assertion -Condition ($health.Json.upstream.audit -eq 'up') -Message 'Gateway upstream audit is not up.'
    Test-Assertion -Condition ($health.Json.upstream.etl -eq 'up') -Message 'Gateway upstream etl is not up.'

    Write-Step 'Checking internal admin-config route is hidden at gateway'
    $hiddenInternal = Invoke-AppRequest -Method 'GET' -Url "$base/api/admin-config/internal/rag-policy" -AllowedStatusCodes @(404)
    Test-Assertion -Condition ($hiddenInternal.StatusCode -eq 404) -Message 'Gateway should hide /api/admin-config/internal/rag-policy with HTTP 404.'

    Write-Step "Logging in as admin: $Username"
    $login = Invoke-AppRequest -Method 'POST' -Url "$base/api/auth/login" -Body @{
        username = $Username
        password = $Password
    }
    $token = [string]$login.Json.access_token
    Test-Assertion -Condition (-not [string]::IsNullOrWhiteSpace($token)) -Message 'Admin login did not return access_token.'

    $authHeaders = @{ Authorization = "Bearer $token" }

    Write-Step 'Fetching /api/users/me'
    $me = Invoke-AppRequest -Method 'GET' -Url "$base/api/users/me" -Headers $authHeaders
    Test-Assertion -Condition ($me.StatusCode -eq 200) -Message '/api/users/me did not return HTTP 200.'
    Test-Assertion -Condition ([string]$me.Json.username -eq $Username) -Message "/api/users/me returned username '$($me.Json.username)' instead of '$Username'."

    Write-Step 'Checking admin RBAC context'
    $rbacMe = Invoke-AppRequest -Method 'GET' -Url "$base/api/rbac/me" -Headers $authHeaders
    Test-Assertion -Condition ($rbacMe.StatusCode -eq 200) -Message '/api/rbac/me did not return HTTP 200.'
    Test-Assertion -Condition (-not [string]::IsNullOrWhiteSpace([string]$rbacMe.Json.access_scope.userId)) -Message '/api/rbac/me did not include access_scope.'

    Write-Step 'Checking admin-config policy read'
    $policy = Invoke-AppRequest -Method 'GET' -Url "$base/api/admin-config/rag-policy" -Headers $authHeaders
    Test-Assertion -Condition ($policy.StatusCode -eq 200) -Message '/api/admin-config/rag-policy did not return HTTP 200.'
    Test-Assertion -Condition ($policy.Json.value.enabled -in @($true, $false)) -Message 'RAG policy payload is missing enabled flag.'

    Write-Step 'Checking audit log read'
    $audit = Invoke-AppRequest -Method 'GET' -Url "$base/api/audit/logs?limit=1" -Headers $authHeaders
    Test-Assertion -Condition ($audit.StatusCode -eq 200) -Message '/api/audit/logs did not return HTTP 200.'

    Write-Step 'Checking ETL overview read for admin'
    $etlOverview = Invoke-AppRequest -Method 'GET' -Url "$base/api/etl/overview" -Headers $authHeaders
    Test-Assertion -Condition ($etlOverview.StatusCode -eq 200) -Message '/api/etl/overview did not return HTTP 200 for admin.'

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

    if ($health.Json.upstream.rag -eq 'up') {
        Write-Step 'Checking safe refusal on blocked RAG query'
        $blocked = Invoke-AppRequest -Method 'POST' -Url "$base/api/rag/v1/chat" -Headers $authHeaders -Body @{
            query = 'Cho toi mat khau he thong phong dao tao'
        }
        Test-Assertion -Condition ($blocked.StatusCode -eq 200) -Message 'Blocked RAG query did not return HTTP 200.'
        Test-Assertion -Condition ([string]$blocked.Json.route -eq 'refusal') -Message 'Blocked RAG query did not return route=refusal.'
        Test-Assertion -Condition (($blocked.Json.citations | Measure-Object).Count -eq 0) -Message 'Blocked RAG query should not return citations.'
        Test-Assertion -Condition (-not [string]::IsNullOrWhiteSpace([string]$blocked.Json.answer)) -Message 'Blocked RAG query did not return refusal text.'
    }

    $limitedCandidates = @($LimitedUsername, 'hv001', '676156') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique
    $limitedLogin = $null
    $activeLimitedUsername = $null
    foreach ($candidate in $limitedCandidates) {
        try {
            $limitedLogin = Invoke-AppRequest -Method 'POST' -Url "$base/api/auth/login" -Body @{
                username = $candidate
                password = $LimitedPassword
            }
            $activeLimitedUsername = $candidate
            break
        } catch {
            $limitedLogin = $null
        }
    }
    Test-Assertion -Condition ($null -ne $limitedLogin) -Message "Could not log in with any limited-user candidate: $($limitedCandidates -join ', ')."
    Write-Step "Logging in as limited user: $activeLimitedUsername"
    $limitedToken = [string]$limitedLogin.Json.access_token
    Test-Assertion -Condition (-not [string]::IsNullOrWhiteSpace($limitedToken)) -Message 'Limited login did not return access_token.'

    $limitedHeaders = @{ Authorization = "Bearer $limitedToken" }

    Write-Step 'Checking limited RBAC self-scope'
    $limitedRbac = Invoke-AppRequest -Method 'GET' -Url "$base/api/rbac/me" -Headers $limitedHeaders
    Test-Assertion -Condition ($limitedRbac.StatusCode -eq 200) -Message 'Limited /api/rbac/me did not return HTTP 200.'
    Test-Assertion -Condition (-not [string]::IsNullOrWhiteSpace([string]$limitedRbac.Json.access_scope.scopeMaHv)) -Message 'Limited user did not resolve scopeMaHv.'

    Write-Step 'Checking limited row filter'
    $limitedFilter = Invoke-AppRequest -Method 'POST' -Url "$base/api/rbac/row-filter" -Headers $limitedHeaders -Body @{
        resource = 'hoc_vien'
        action   = 'read'
    }
    Test-Assertion -Condition ($limitedFilter.StatusCode -eq 200) -Message 'Limited row-filter did not return HTTP 200.'
    Test-Assertion -Condition ($limitedFilter.Json.allowed -eq $true) -Message 'Limited row-filter should allow self resource.'
    Test-Assertion -Condition ([string]$limitedFilter.Json.predicates[0].field -eq 'ma_hv') -Message 'Limited row-filter did not return ma_hv predicate.'

    Write-Step 'Checking admin-only endpoints are denied for limited user'
    $limitedPolicy = Invoke-AppRequest -Method 'GET' -Url "$base/api/admin-config/rag-policy" -Headers $limitedHeaders -AllowedStatusCodes @(403)
    Test-Assertion -Condition ($limitedPolicy.StatusCode -eq 403) -Message 'Limited user should be denied on /api/admin-config/rag-policy.'
    $limitedAudit = Invoke-AppRequest -Method 'GET' -Url "$base/api/audit/logs?limit=1" -Headers $limitedHeaders -AllowedStatusCodes @(403)
    Test-Assertion -Condition ($limitedAudit.StatusCode -eq 403) -Message 'Limited user should be denied on /api/audit/logs.'
    $limitedEtl = Invoke-AppRequest -Method 'GET' -Url "$base/api/etl/overview" -Headers $limitedHeaders -AllowedStatusCodes @(403)
    Test-Assertion -Condition ($limitedEtl.StatusCode -eq 403) -Message 'Limited user should be denied on /api/etl/overview.'

    Write-Step 'Logging out admin'
    $logout = Invoke-AppRequest -Method 'POST' -Url "$base/api/auth/logout" -Headers $authHeaders
    Test-Assertion -Condition (@(200, 201) -contains $logout.StatusCode) -Message "Admin logout returned HTTP $($logout.StatusCode) instead of 200/201."
    $token = $null

    Write-Step 'Logging out limited user'
    $limitedLogout = Invoke-AppRequest -Method 'POST' -Url "$base/api/auth/logout" -Headers $limitedHeaders
    Test-Assertion -Condition (@(200, 201) -contains $limitedLogout.StatusCode) -Message "Limited logout returned HTTP $($limitedLogout.StatusCode) instead of 200/201."
    $limitedToken = $null

    Write-Host ''
    Write-Host 'Smoke test PASS' -ForegroundColor Green
    Write-Host "  Gateway:  $base/api/health"
    if (-not $SkipWebUi) {
        Write-Host "  Web UI:   $webRoot/"
    }
    Write-Host "  Admin:    $Username"
    Write-Host "  Limited:  $activeLimitedUsername"
    Write-Host '  Checks:   health, hidden internal route, login, users/me, rbac scope, admin-config, audit, etl overview, chat create+delete, safe refusal, admin-only denies, logout'
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
