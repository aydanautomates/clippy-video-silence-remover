# Video Auto-Clipper (Silence Removal)

Automatically remove silent sections from video files. Includes a CLI tool and a web UI with drag-and-drop upload.

Uses hardware-accelerated encoding when available (VideoToolbox on Mac, NVENC on NVIDIA GPUs, falls back to libx264).

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** (for the web UI)
- **FFmpeg** installed and available in PATH

Install FFmpeg:
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows (with chocolatey)
choco install ffmpeg
```

## Getting Started

### Option A: Let Claude Code do everything (easiest)

If you have [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed, you don't need to set anything up manually. Just open Claude Code in this project folder and paste the following prompt:

```
I just cloned the Video Auto-Clipper project. Can you:

1. Install all dependencies (Python packages for the backend, npm packages for
   the frontend)
2. Make sure FFmpeg is installed on my system (install it if it's not)
3. Run ./start.sh to launch the app
4. Tell me when it's ready and what URL to open

If anything goes wrong during setup, fix it and keep going.
```

Claude Code will read the project, install everything, and start the app for you. When it's done, just open the URL it gives you and drag in your video.

### Option B: One command start

If dependencies are already installed, just run:

```bash
./start.sh
```

This starts both the backend and frontend in one terminal. Open **http://localhost:3000** and you're good to go. Press `Ctrl+C` to stop everything.

### Option C: Full manual setup

If you're setting up for the first time without Claude Code:

```bash
# 1. Install dependencies
pip install -r api/requirements.txt
cd web && npm install && cd ..

# 2. Start the app
./start.sh
```

Then open **http://localhost:3000**, drag in a video, adjust settings, and hit Process.

### Option D: CLI only (no web UI)

If you just want to process a video from the command line:

```bash
pip install -r requirements.txt
python silence_remover.py input.mp4 output.mp4 --threshold -40 --padding 150 --min-silence 500
```

## CLI Arguments

| Argument | Description | Default |
|---|---|---|
| `input` | Input video file path | (required) |
| `output` | Output video file path | (required) |
| `--threshold` | Silence threshold in dB (lower = more sensitive) | `-35` |
| `--padding` | Buffer around each cut in ms | `100` |
| `--min-silence` | Minimum silence duration to detect in ms | `300` |

## Recommended Settings

These settings work well as a starting point for talking-head videos, podcasts, and screen recordings:

| Setting | Recommended | What it does |
|---|---|---|
| Silence Threshold | `-40dB` | Cuts only the truly quiet parts without eating into soft speech |
| Padding | `150ms` | Gives each clip a little breathing room so words don't feel chopped |
| Min Silence Length | `500ms` | Removes long dead air but keeps natural pauses between sentences |

```bash
python silence_remover.py input.mp4 output.mp4 --threshold -40 --padding 150 --min-silence 500
```

Every video is different though — background noise, mic distance, and speaking style all affect what works best. Use these as a starting point, then play around with the sliders in the web UI until the output feels right for your content.

## Tuning Tips

- **Too much silence left?** Lower the threshold (e.g. `-45dB` or `-50dB`).
- **Cutting into speech?** Raise the threshold (e.g. `-30dB`) or increase padding.
- **Words getting clipped?** Increase padding to `200ms` or higher.
- **Removing pauses you want to keep?** Increase min silence length to `700ms+`.

## Project Structure

```
silence_remover.py    # CLI tool (standalone)
api/                  # FastAPI backend for the web UI
  main.py             # Upload, status, and download endpoints
  processor.py        # Wraps CLI logic into async job runner
web/                  # Next.js frontend
  app/page.tsx        # Main page with upload, controls, and status
```

## License

MIT
