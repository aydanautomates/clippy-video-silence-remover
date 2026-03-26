#!/bin/bash
# Start both backend and frontend servers

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting Video Auto-Clipper..."

# Start backend
cd "$DIR/api" && uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# Start frontend
cd "$DIR/web" && npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers."

# Kill both on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
