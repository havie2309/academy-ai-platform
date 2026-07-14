Write-Host "Stopping all development processes..." -ForegroundColor Yellow

# ----------------------------------------------------------------------
# 1. Kill processes by port using taskkill /F /T (tree kill)
# ----------------------------------------------------------------------
$ports = @(3000,3001,3002,3003,3004,3005,8000,8001,8002,8003,5174,5175,5176,5177,5178)

foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        if ($conn.State -eq 'Listen' -or $conn.State -eq 'Established') {
            $procId = $conn.OwningProcess
            if ($procId) {
                Write-Host "Killing process tree PID $procId (port $port)" -ForegroundColor Yellow
                # 2>$null suppresses "process not found" errors (they're harmless)
                taskkill /F /T /PID $procId 2>$null
            }
        }
    }
}

# ----------------------------------------------------------------------
# 2. Kill PowerShell launchers (run-with-log.ps1) – these hold log files
# ----------------------------------------------------------------------
Get-WmiObject -Class Win32_Process -Filter "Name = 'powershell.exe' OR Name = 'pwsh.exe'" | Where-Object {
    $_.CommandLine -like "*run-with-log.ps1*"
} | ForEach-Object {
    Write-Host "Killing PowerShell tree PID $($_.ProcessId)" -ForegroundColor Yellow
    taskkill /F /T /PID $_.ProcessId 2>$null
}

# ----------------------------------------------------------------------
# 3. Kill Node.js processes (nest start, vite)
# ----------------------------------------------------------------------
Get-WmiObject -Class Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
    $_.CommandLine -like "*nest start*" -or
    $_.CommandLine -like "*vite*" -or
    $_.CommandLine -like "*web-ui*"
} | ForEach-Object {
    Write-Host "Killing Node.js tree PID $($_.ProcessId)" -ForegroundColor Yellow
    taskkill /F /T /PID $_.ProcessId 2>$null
}

# ----------------------------------------------------------------------
# 4. Kill Python processes (uvicorn, services)
# ----------------------------------------------------------------------
# Use WMI to catch all python variants (python.exe, python3.exe, py.exe)
Get-WmiObject -Class Win32_Process -Filter "Name LIKE 'python%' OR Name = 'py.exe'" | Where-Object {
    $_.CommandLine -like "*uvicorn*" -or
    $_.CommandLine -like "*main:app*" -or
    $_.CommandLine -like "*$PWD*services*"
} | ForEach-Object {
    Write-Host "Killing Python tree PID $($_.ProcessId)" -ForegroundColor Yellow
    taskkill /F /T /PID $_.ProcessId 2>$null
}

# ----------------------------------------------------------------------
# 5. Kill Ollama (if still running)
# ----------------------------------------------------------------------
Get-Process -Name ollama -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Killing Ollama tree PID $($_.Id)" -ForegroundColor Yellow
    taskkill /F /T /PID $_.Id 2>$null
}

# ----------------------------------------------------------------------
# 6. Stop Docker containers
# ----------------------------------------------------------------------
& .\scripts\down.ps1

Write-Host "All processes stopped. Docker containers are down." -ForegroundColor Green
