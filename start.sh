#!/bin/bash
# Start Clippy — API + Frontend
# Usage: ./start.sh       → start both servers & open browser
#        ./start.sh stop  → kill Clippy servers only
#        ./start.sh dev   → dev mode (slow first load, use for development only)

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
API_PORT=8000
FRONTEND_PORT=3001
LOG_DIR="$DIR/.logs"
mkdir -p "$LOG_DIR"

# ── Helpers ──────────────────────────────────────────────────

red()   { printf '\033[1;31m%s\033[0m\n' "$1"; }
green() { printf '\033[1;32m%s\033[0m\n' "$1"; }
dim()   { printf '\033[2m%s\033[0m\n' "$1"; }

stop_clippy() {
  local killed=0
  while IFS= read -r pid; do
    kill "$pid" 2>/dev/null && killed=1
  done < <(ps aux | grep "uvicorn main:app" | grep "$DIR" | grep -v grep | awk '{print $2}')
  while IFS= read -r pid; do
    kill "$pid" 2>/dev/null && killed=1
  done < <(ps aux | grep -E "next (dev|start)" | grep "$DIR" | grep -v grep | awk '{print $2}')
  lsof -iTCP:$API_PORT -sTCP:LISTEN -t 2>/dev/null | while read -r pid; do
    local cmd; cmd=$(ps -p "$pid" -o args= 2>/dev/null)
    if echo "$cmd" | grep -q "$DIR"; then kill -9 "$pid" 2>/dev/null && killed=1; fi
  done
  lsof -iTCP:$FRONTEND_PORT -sTCP:LISTEN -t 2>/dev/null | while read -r pid; do
    local cmd; cmd=$(ps -p "$pid" -o args= 2>/dev/null)
    if echo "$cmd" | grep -q "$DIR"; then kill -9 "$pid" 2>/dev/null && killed=1; fi
  done
  if [ "$killed" = 1 ]; then sleep 1; fi
  green "Clippy stopped."
}

check_port() {
  local port=$1
  if lsof -iTCP:"$port" -sTCP:LISTEN -P -n &>/dev/null; then
    local pids cmd is_ours=0
    pids=$(lsof -iTCP:"$port" -sTCP:LISTEN -P -n -t 2>/dev/null)
    for pid in $pids; do
      cmd=$(ps -p "$pid" -o args= 2>/dev/null || echo "unknown")
      # Match project path directly, or match next-server/uvicorn spawned by us
      if echo "$cmd" | grep -q "$DIR" || echo "$cmd" | grep -qE "^next-server |^/.*uvicorn"; then
        # Check parent process too for child workers
        local ppid_cmd
        ppid_cmd=$(ps -p "$(ps -p "$pid" -o ppid= 2>/dev/null | tr -d ' ')" -o args= 2>/dev/null || echo "")
        if echo "$cmd" | grep -q "$DIR" || echo "$ppid_cmd" | grep -q "$DIR"; then
          kill -9 "$pid" 2>/dev/null; is_ours=1
        fi
      fi
    done
    if [ "$is_ours" = 1 ]; then
      sleep 1
    elif lsof -iTCP:"$port" -sTCP:LISTEN -P -n &>/dev/null; then
      local show_pid show_cmd
      show_pid=$(lsof -iTCP:"$port" -sTCP:LISTEN -P -n -t 2>/dev/null | head -1)
      show_cmd=$(ps -p "$show_pid" -o args= 2>/dev/null || echo "unknown")
      red "ERROR: Port $port is already in use by another app."
      dim "  PID $show_pid: $show_cmd"
      dim "  Free it up and try again, or kill it with: kill $show_pid"
      exit 1
    fi
  fi
}

# ── Stop mode ────────────────────────────────────────────────

if [ "$1" = "stop" ]; then
  stop_clippy
  exit 0
fi

# ── Preflight checks ────────────────────────────────────────

missing=()
command -v python3 &>/dev/null || missing+=("python3")
command -v node    &>/dev/null || missing+=("node")
command -v ffmpeg  &>/dev/null || missing+=("ffmpeg (brew install ffmpeg)")

if [ ${#missing[@]} -gt 0 ]; then
  red "Missing dependencies: ${missing[*]}"
  exit 1
fi

if [ ! -d "$DIR/web/node_modules" ]; then
  red "Frontend dependencies not installed. Run: cd web && npm install"
  exit 1
fi

if ! python3 -c "import fastapi, uvicorn, pydub" 2>/dev/null; then
  red "Python dependencies not installed. Run: pip install -r api/requirements.txt"
  exit 1
fi

# ── Kill any previous Clippy, then claim ports ───────────────

stop_clippy 2>/dev/null
check_port $API_PORT
check_port $FRONTEND_PORT

# ── Build frontend if needed ─────────────────────────────────

DEV_MODE=0
if [ "$1" = "dev" ]; then
  DEV_MODE=1
fi

if [ "$DEV_MODE" = 0 ]; then
  # Production mode — build once, starts instantly
  if [ ! -d "$DIR/web/.next" ] || [ "$DIR/web/app/page.tsx" -nt "$DIR/web/.next/BUILD_ID" ] 2>/dev/null; then
    echo ""
    echo "Building frontend (one-time)..."
    cd "$DIR/web"
    npx next build >"$LOG_DIR/build.log" 2>&1
    if [ $? -ne 0 ]; then
      red "Frontend build failed. Check logs: $LOG_DIR/build.log"
      echo ""
      tail -20 "$LOG_DIR/build.log"
      exit 1
    fi
    green "Build complete."
  fi
fi

# ── Start servers ────────────────────────────────────────────

echo ""
echo "Starting Clippy..."
echo ""

# API
cd "$DIR/api"
python3 -m uvicorn main:app --reload --port $API_PORT \
  >"$LOG_DIR/api.log" 2>&1 &
API_PID=$!

# Frontend
cd "$DIR/web"
if [ "$DEV_MODE" = 1 ]; then
  node node_modules/.bin/next dev -p $FRONTEND_PORT \
    >"$LOG_DIR/frontend.log" 2>&1 &
else
  PORT=$FRONTEND_PORT node node_modules/.bin/next start -p $FRONTEND_PORT \
    >"$LOG_DIR/frontend.log" 2>&1 &
fi
FRONTEND_PID=$!

# ── Wait for both to be ready ────────────────────────────────

api_ready=0
frontend_ready=0

for i in $(seq 1 30); do
  if ! kill -0 $API_PID 2>/dev/null && [ "$api_ready" = 0 ]; then
    red "API failed to start. Check logs: $LOG_DIR/api.log"
    echo ""; tail -20 "$LOG_DIR/api.log" 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 1
  fi
  if ! kill -0 $FRONTEND_PID 2>/dev/null && [ "$frontend_ready" = 0 ]; then
    red "Frontend failed to start. Check logs: $LOG_DIR/frontend.log"
    echo ""; tail -20 "$LOG_DIR/frontend.log" 2>/dev/null
    kill $API_PID 2>/dev/null
    exit 1
  fi

  if [ "$api_ready" = 0 ] && lsof -iTCP:$API_PORT -sTCP:LISTEN -P -n &>/dev/null; then
    api_ready=1
    dim "  ✓ API ready"
  fi
  if [ "$frontend_ready" = 0 ] && lsof -iTCP:$FRONTEND_PORT -sTCP:LISTEN -P -n &>/dev/null; then
    frontend_ready=1
    dim "  ✓ Frontend ready"
  fi

  if [ "$api_ready" = 1 ] && [ "$frontend_ready" = 1 ]; then break; fi
  sleep 1
done

if [ "$api_ready" = 0 ] || [ "$frontend_ready" = 0 ]; then
  red "Timed out waiting for servers to start."
  [ "$api_ready" = 0 ]      && echo "" && red "API log:" && tail -20 "$LOG_DIR/api.log" 2>/dev/null
  [ "$frontend_ready" = 0 ] && echo "" && red "Frontend log:" && tail -20 "$LOG_DIR/frontend.log" 2>/dev/null
  kill $API_PID $FRONTEND_PID 2>/dev/null
  exit 1
fi

echo ""
green "Clippy is ready!"
echo ""
echo "  http://localhost:$FRONTEND_PORT"
echo ""

open "http://localhost:$FRONTEND_PORT"

echo "Press Ctrl+C to stop."
trap "kill $API_PID $FRONTEND_PID 2>/dev/null; echo ''; green 'Clippy stopped.'; exit" INT TERM
wait
