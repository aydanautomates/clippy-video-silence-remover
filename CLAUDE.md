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

# Start both servers (production build, instant page loads)
./start.sh

# Or dev mode with hot-reload (slow first load)
./start.sh dev
```

`start.sh` builds the frontend for production on first run, then serves it via `next start`. Fixed ports: API on 8000, frontend on 3001. Logs go to `.logs/`.

## Architecture Notes

- CORS in `api/main.py` allows `localhost` and `127.0.0.1` on ports 3000 and 3001
- `next.config.ts` has `allowedDevOrigins: ["127.0.0.1"]` — required for hydration when accessing via 127.0.0.1
- Video processing is async — frontend polls `/api/status/:id` every 2 seconds
- Hardware-accelerated encoding: VideoToolbox (Mac), NVENC (NVIDIA), libx264 fallback

## Known Gotchas

- If sliders/UI isn't interactive, it's a hydration failure — check that `allowedDevOrigins` includes the hostname being used in the browser
- `api/tmp/` is where processed videos are stored temporarily — gitignored
- Next.js dev mode (`next dev`) with Turbopack on Node v25 has ~2.5 min first-compile times — this is why `start.sh` defaults to production build (`next build` + `next start`)
- Next.js 16.2.1 crashes on Node v25 with `isStableBuild is not a function` — 16.2.2 fixes this
