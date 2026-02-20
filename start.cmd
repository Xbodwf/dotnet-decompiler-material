@echo off
REM .NET Decompiler Web GUI Startup Script for Windows
REM This script starts both the backend service and the frontend server

setlocal EnableDelayedExpansion

set PROJECT_DIR=%~dp0
set BACKEND_DIR=%PROJECT_DIR%backend
set FRONTEND_DIR=%PROJECT_DIR%frontend
set BACKEND_PORT=3721
set FRONTEND_PORT=5173

echo === .NET Decompiler Web GUI ===
echo.

REM Kill any existing processes on our ports
echo Checking for existing processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%BACKEND_PORT%" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a 2>nul
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%FRONTEND_PORT%" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a 2>nul
)
timeout /t 1 /nobreak >nul

REM Check if backend is already built
if not exist "%BACKEND_DIR%\bin\Debug\net10.0\DecompilerService.dll" (
    echo Building backend service...
    cd /d "%BACKEND_DIR%"
    dotnet build
    if errorlevel 1 (
        echo Failed to build backend service
        exit /b 1
    )
)

REM Create uploads directory
if not exist "%BACKEND_DIR%\bin\Debug\net10.0\uploads" (
    mkdir "%BACKEND_DIR%\bin\Debug\net10.0\uploads"
)

REM Start backend service
echo Starting backend service on port %BACKEND_PORT%...
cd /d "%BACKEND_DIR%\bin\Debug\net10.0"
start "Decompiler Backend" dotnet DecompilerService.dll
cd /d "%PROJECT_DIR%"

REM Wait for backend to start
timeout /t 2 /nobreak >nul

echo Backend service started.

REM Check if frontend dependencies are installed
if not exist "%FRONTEND_DIR%\node_modules" (
    echo Installing frontend dependencies...
    cd /d "%FRONTEND_DIR%"
    call pnpm install
    cd /d "%PROJECT_DIR%"
)

REM Start frontend server
echo Starting frontend server on port %FRONTEND_PORT%...
cd /d "%FRONTEND_DIR%"
start "Decompiler Frontend" cmd /c "pnpm dev"
cd /d "%PROJECT_DIR%"

echo.
echo === Services Running ===
echo Frontend: http://localhost:%FRONTEND_PORT%
echo Backend API: http://localhost:%BACKEND_PORT%
echo.
echo Press Ctrl+C to stop all services (or close the terminal windows)
echo.

REM Keep the script running
pause
