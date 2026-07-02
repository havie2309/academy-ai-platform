# scripts/stop-dev.ps1 (simpler version)
Write-Host "Stopping all development processes..." -ForegroundColor Yellow

# Kill processes by command line using WMI
$processes = Get-WmiObject -Class Win32_Process -Filter "Name = 'powershell.exe'" | Where-Object {
    $_.CommandLine -like "*run-with-log.ps1*"
}
$processes | ForEach-Object {
    Write-Host "Killing PowerShell PID $($_.ProcessId)" -ForegroundColor Yellow
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

# Kill Node.js
$nodeProcesses = Get-WmiObject -Class Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
    $_.CommandLine -like "*nest start*"
}
$nodeProcesses | ForEach-Object {
    Write-Host "Killing Node.js PID $($_.ProcessId)" -ForegroundColor Yellow
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

# Kill Python uvicorn
$pythonProcesses = Get-WmiObject -Class Win32_Process -Filter "Name = 'python.exe'" | Where-Object {
    $_.CommandLine -like "*uvicorn*"
}
$pythonProcesses | ForEach-Object {
    Write-Host "Killing Python PID $($_.ProcessId)" -ForegroundColor Yellow
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

# Stop Docker
& .\scripts\down.ps1

Write-Host "All processes stopped. Docker containers are down." -ForegroundColor Green