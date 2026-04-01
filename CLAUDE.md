# Clippy — CLAUDE.md

Project context for Claude Code. This file helps Claude understand the codebase when assisting with development.

## Stack

- **Frontend:** Next.js (React) — `web/`
- **API:** FastAPI + Uvicorn — `api/`
- **Processing:** FFmpeg via pydub (silence detection) and subprocess (trimming/encoding)
- **CLI:** `silence_remover.py` (standalone, no server needed)

## Running Locally

```bash
# Install deps
pip install -r api/requirements.txt
cd web && npm install && cd ..

# Start both servers
./start.sh
```

`start.sh` auto-detects port conflicts and bumps to the next free port. Default ports: API on 8000, frontend on 3001.

## Architecture Notes

- CORS in `api/main.py` allows `localhost` and `127.0.0.1` on ports 3000 and 3001
- `next.config.ts` has `allowedDevOrigins: ["127.0.0.1"]` — required for hydration when accessing via 127.0.0.1
- Video processing is async — frontend polls `/api/status/:id` every 2 seconds
- Hardware-accelerated encoding: VideoToolbox (Mac), NVENC (NVIDIA), libx264 fallback

## Known Gotchas

- If sliders/UI isn't interactive, it's a hydration failure — check that `allowedDevOrigins` includes the hostname being used in the browser
- `api/tmp/` is where processed videos are stored temporarily — gitignored
