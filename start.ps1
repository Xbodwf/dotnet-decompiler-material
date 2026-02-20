#!/usr/bin/env pwsh
# .NET Decompiler Web GUI Startup Script for Windows (PowerShell)
# This script starts both the backend service and the frontend server

param()

$ErrorActionPreference = "Continue"

$PROJECT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND_DIR = Join-Path $PROJECT_DIR "backend"
$FRONTEND_DIR = Join-Path $PROJECT_DIR "frontend"
$BACKEND_PORT = 3721
$FRONTEND_PORT = 5173

Write-Host "=== .NET Decompiler Web GUI ===" -ForegroundColor Cyan
Write-Host ""

# Kill any existing processes on our ports
Write-Host "Checking for existing processes..." -ForegroundColor Yellow

$backendProcess = Get-NetTCPConnection -LocalPort $BACKEND_PORT -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($backendProcess) {
    Stop-Process -Id $backendProcess -Force -ErrorAction SilentlyContinue
}

$frontendProcess = Get-NetTCPConnection -LocalPort $FRONTEND_PORT -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($frontendProcess) {
    Stop-Process -Id $frontendProcess -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 1

# Check if backend is already built
$backendDll = Join-Path $BACKEND_DIR "bin/Debug/net10.0/DecompilerService.dll"
if (-not (Test-Path $backendDll)) {
    Write-Host "Building backend service..." -ForegroundColor Yellow
    Push-Location $BACKEND_DIR
    dotnet build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to build backend service" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
}

# Create uploads directory
$uploadsDir = Join-Path $BACKEND_DIR "bin/Debug/net10.0/uploads"
if (-not (Test-Path $uploadsDir)) {
    New-Item -ItemType Directory -Path $uploadsDir -Force | Out-Null
}

# Start backend service
Write-Host "Starting backend service on port $BACKEND_PORT..." -ForegroundColor Yellow
Push-Location (Join-Path $BACKEND_DIR "bin/Debug/net10.0")
$backendJob = Start-Process -FilePath "dotnet" -ArgumentList "DecompilerService.dll" -PassThru -WindowStyle Normal
Pop-Location

Start-Sleep -Seconds 2

Write-Host "Backend service started (PID: $($backendJob.Id))" -ForegroundColor Green

# Check if frontend dependencies are installed
$nodeModules = Join-Path $FRONTEND_DIR "node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Push-Location $FRONTEND_DIR
    pnpm install
    Pop-Location
}

# Start frontend server
Write-Host "Starting frontend server on port $FRONTEND_PORT..." -ForegroundColor Yellow
Push-Location $FRONTEND_DIR
$frontendJob = Start-Process -FilePath "cmd" -ArgumentList "/c pnpm dev" -PassThru -WindowStyle Normal
Pop-Location

Write-Host "Frontend server started (PID: $($frontendJob.Id))" -ForegroundColor Green

Write-Host ""
Write-Host "=== Services Running ===" -ForegroundColor Cyan
Write-Host "Frontend: " -NoNewline; Write-Host "http://localhost:$FRONTEND_PORT" -ForegroundColor Green
Write-Host "Backend API: " -NoNewline; Write-Host "http://localhost:$BACKEND_PORT" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Trap for cleanup
try {
    # Keep the script running
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host ""
    Write-Host "Stopping services..." -ForegroundColor Yellow
    if ($backendJob) {
        Stop-Process -Id $backendJob.Id -Force -ErrorAction SilentlyContinue
    }
    if ($frontendJob) {
        Stop-Process -Id $frontendJob.Id -Force -ErrorAction SilentlyContinue
    }
}
