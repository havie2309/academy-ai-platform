# scripts/stop-dev.ps1
Write-Host "Stopping all development processes..." -ForegroundColor Yellow

# ----------------------------------------------------------------------
# 1. Kill processes by port (most reliable)
# ----------------------------------------------------------------------
$ports = @(3000,3001,3002,3003,3004,3005,8000,8001,8002,8003,5174,5175,5176,5177,5178)

foreach ($port in $ports) {
    # Get TCP connections listening on this port
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        # Check if state is Listening or Established (for servers)
        if ($conn.State -eq 'Listen' -or $conn.State -eq 'Established') {
            $procId = $conn.OwningProcess
            if ($procId) {
                Write-Host "Killing process PID $procId using port $port" -ForegroundColor Yellow
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

# ----------------------------------------------------------------------
# 2. Kill by command‑line patterns (fallback)
# ----------------------------------------------------------------------

# Kill PowerShell processes running the runner
Get-WmiObject -Class Win32_Process -Filter "Name = 'powershell.exe'" | Where-Object {
    $_.CommandLine -like "*run-with-log.ps1*"
} | ForEach-Object {
    Write-Host "Killing PowerShell PID $($_.ProcessId)" -ForegroundColor Yellow
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

# Kill Node.js processes (nest start, vite, web‑ui)
Get-WmiObject -Class Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
    $_.CommandLine -like "*nest start*" -or
    $_.CommandLine -like "*vite*" -or
    $_.CommandLine -like "*web-ui*"
} | ForEach-Object {
    Write-Host "Killing Node.js PID $($_.ProcessId)" -ForegroundColor Yellow
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

# Kill Python uvicorn processes
Get-WmiObject -Class Win32_Process -Filter "Name = 'python.exe'" | Where-Object {
    $_.CommandLine -like "*uvicorn*"
} | ForEach-Object {
    Write-Host "Killing Python PID $($_.ProcessId)" -ForegroundColor Yellow
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

# Kill Ollama (if still running)
Get-Process -Name ollama -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Killing Ollama PID $($_.Id)" -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

# ----------------------------------------------------------------------
# 3. Stop Docker containers
# ----------------------------------------------------------------------
& .\scripts\down.ps1

Write-Host "All processes stopped. Docker containers are down." -ForegroundColor Green
