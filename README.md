# Clippy — Automatic Video Silence Remover

![Clippy Screenshot](Screenshot%202026-03-26%20at%203.33.59%20AM.png)

Clippy removes silent sections from your videos automatically. Upload one or multiple videos through the web UI, tweak the sensitivity, and download trimmed clips — no editing skills required.

Uses hardware-accelerated encoding when available (VideoToolbox on Mac, NVENC on NVIDIA GPUs, falls back to libx264).

## Features

- Drag-and-drop web UI with real-time status
- Batch processing — upload multiple videos, get them all trimmed
- Adjustable silence threshold, padding, and minimum silence length
- Individual clip downloads + merged output for batch jobs
- CLI tool for scripting and automation
- Hardware-accelerated encoding (VideoToolbox, NVENC, or software fallback)

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** (for the web UI)
- **FFmpeg** installed and available in PATH

Install FFmpeg if you don't have it:

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows (with chocolatey)
choco install ffmpeg
```

---

## Quick Start with Claude Code (Recommended)

The fastest way to get Clippy running is with [Claude Code](https://docs.anthropic.com/en/docs/claude-code). It reads the project, installs everything, and starts the app for you.

### 1. Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

### 2. Clone and open the project

```bash
git clone https://github.com/aydanautomates/clippy-video-silence-remover.git
cd clippy-video-silence-remover
claude
```

### 3. Ask Claude to set it up

Paste this into Claude Code:

```
I just cloned Clippy. Can you:

1. Install all dependencies (Python packages for the backend, npm packages for the frontend)
2. Make sure FFmpeg is installed on my system (install it if it's not)
3. Run ./start.sh to launch the app
4. Tell me when it's ready and what URL to open

If anything goes wrong during setup, fix it and keep going.
```

Claude Code will handle the rest. When it's done, open the URL it gives you and drag in your video.

---

## Manual Setup

If you prefer to set things up yourself:

```bash
# Clone the repo
git clone https://github.com/aydanautomates/clippy-video-silence-remover.git
cd clippy-video-silence-remover

# Install Python dependencies
pip install -r api/requirements.txt

# Install frontend dependencies
cd web && npm install && cd ..

# Start both servers
./start.sh
```

The app opens automatically in your browser. If not, check the terminal for the URL (usually `http://localhost:3001`).

To stop: press `Ctrl+C` or run `./start.sh stop`.

---

## CLI Usage

You can also use the silence remover directly from the command line without the web UI:

```bash
pip install -r requirements.txt
python silence_remover.py input.mp4 output.mp4 --threshold -40 --padding 150 --min-silence 500
```

### Arguments

| Argument | Description | Default |
|---|---|---|
| `input` | Input video file path | (required) |
| `output` | Output video file path | (required) |
| `--threshold` | Silence threshold in dB (lower = more sensitive) | `-35` |
| `--padding` | Buffer around each cut in ms | `100` |
| `--min-silence` | Minimum silence duration to detect in ms | `300` |

---

## Recommended Settings

Good starting point for talking-head videos, podcasts, and screen recordings:

| Setting | Recommended | What it does |
|---|---|---|
| Silence Threshold | `-40 dB` | Cuts only the truly quiet parts without eating into soft speech |
| Padding | `150 ms` | Gives each clip breathing room so words don't feel chopped |
| Min Silence Length | `500 ms` | Removes long dead air but keeps natural pauses |

Every video is different — background noise, mic distance, and speaking style all affect what works best. Use these as a starting point, then adjust with the sliders.

### Tuning Tips

- **Too much silence left?** Lower the threshold (e.g. `-45 dB` or `-50 dB`)
- **Cutting into speech?** Raise the threshold (e.g. `-30 dB`) or increase padding
- **Words getting clipped?** Increase padding to `200 ms` or higher
- **Removing pauses you want to keep?** Increase min silence length to `700 ms+`

---

## Project Structure

```
silence_remover.py    # CLI tool (standalone)
api/                  # FastAPI backend
  main.py             # Upload, status, and download endpoints
  processor.py        # Async job runner wrapping CLI logic
web/                  # Next.js frontend
  app/page.tsx        # Main UI — upload, controls, status
start.sh              # Launches both servers with auto port detection
```

## License

MIT — see [LICENSE](LICENSE).
