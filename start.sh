#!/bin/bash
# Start Clippy — API + Frontend
# Usage: ./start.sh       → start both servers & open browser
#        ./start.sh stop  → kill Clippy servers only

DIR="$(cd "$(dirname "$0")" && pwd)"

# Find a free port starting from a preferred one
find_port() {
  local port=$1
  while lsof -iTCP:"$port" -sTCP:LISTEN -P -n &>/dev/null; do
    # Check if it's a Clippy zombie we can kill
    local cmd
    cmd=$(lsof -iTCP:"$port" -sTCP:LISTEN -P -n -t 2>/dev/null | head -1 | xargs -I{} ps -p {} -o args= 2>/dev/null)
    if echo "$cmd" | grep -q "$DIR"; then
      # It's ours — kill the zombie
      lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | xargs kill 2>/dev/null
      sleep 1
      break
    fi
    # Not ours — try next port
    port=$((port + 1))
  done
  echo "$port"
}

stop_clippy() {
  # Kill only Clippy processes, not other apps
  ps aux | grep -E "uvicorn main:app.*--port" | grep "$DIR" | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null
  ps aux | grep "next dev" | grep "$DIR" | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null
  echo "Clippy stopped."
}

if [ "$1" = "stop" ]; then
  stop_clippy
  exit 0
fi

echo "Starting Clippy..."

# Find available ports
API_PORT=$(find_port 8000)
FRONTEND_PORT=$(find_port 3001)

# Start API
cd "$DIR/api" && uvicorn main:app --reload --port "$API_PORT" &>/dev/null &
BACKEND_PID=$!

# Start Frontend
cd "$DIR/web" && PORT="$FRONTEND_PORT" node node_modules/.bin/next dev -p "$FRONTEND_PORT" &>/dev/null &
FRONTEND_PID=$!

# Wait for frontend to be ready, then open browser
echo "Waiting for servers..."
for i in $(seq 1 30); do
  if lsof -iTCP:"$FRONTEND_PORT" -sTCP:LISTEN -P -n &>/dev/null; then
    echo "Clippy is ready → http://localhost:$FRONTEND_PORT"
    open "http://localhost:$FRONTEND_PORT"
    break
  fi
  sleep 2
done

echo ""
echo "Backend:  http://localhost:$API_PORT"
echo "Frontend: http://localhost:$FRONTEND_PORT"
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
