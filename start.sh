#!/bin/bash

# .NET Decompiler Web GUI Startup Script
# This script starts both the backend service and the frontend server

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKEND_PORT=3721
FRONTEND_PORT=5173

echo "=== .NET Decompiler Web GUI ==="
echo ""

# Kill any existing processes on our ports
echo "Checking for existing processes..."
fuser -k ${BACKEND_PORT}/tcp 2>/dev/null
fuser -k ${FRONTEND_PORT}/tcp 2>/dev/null
sleep 1

# Check if backend is already built
if [ ! -f "$BACKEND_DIR/bin/Debug/net10.0/DecompilerService.dll" ]; then
    echo "Building backend service..."
    cd "$BACKEND_DIR"
    dotnet build
    if [ $? -ne 0 ]; then
        echo "Failed to build backend service"
        exit 1
    fi
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping services..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    # Also kill any child processes
    pkill -P $$ 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend service
echo "Starting backend service on port $BACKEND_PORT..."
cd "$BACKEND_DIR/bin/Debug/net10.0"
mkdir -p uploads
dotnet DecompilerService.dll &
BACKEND_PID=$!
cd "$PROJECT_DIR"

# Wait for backend to start
sleep 2

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "Failed to start backend service"
    exit 1
fi

echo "Backend service started (PID: $BACKEND_PID)"

# Start frontend dev server
echo "Starting frontend dev server on port $FRONTEND_PORT..."
cd "$FRONTEND_DIR"
pnpm dev --host &
FRONTEND_PID=$!
cd "$PROJECT_DIR"

echo "Frontend server started (PID: $FRONTEND_PID)"

echo ""
echo "=== Services Running ==="
echo "Frontend: http://localhost:$FRONTEND_PORT"
echo "Backend API: http://localhost:$BACKEND_PORT"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for either process to exit
wait $BACKEND_PID $FRONTEND_PID