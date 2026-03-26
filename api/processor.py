"""Job processor that wraps silence_remover.py functions."""

import sys
import uuid
import threading
import importlib
import tempfile
import shutil
from pathlib import Path

# Add parent directory to path so we can import silence_remover
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import silence_remover


def _reload():
    """Always use the latest version of silence_remover."""
    importlib.reload(silence_remover)
    return (
        silence_remover.extract_audio,
        silence_remover.detect_speaking_segments,
        silence_remover.build_trimmed_video,
    )

JOBS_DIR = Path(__file__).resolve().parent / "tmp"
JOBS_DIR.mkdir(exist_ok=True)

# In-memory job status store
jobs: dict[str, dict] = {}


def create_job(input_filename: str) -> str:
    job_id = uuid.uuid4().hex[:12]
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True)
    jobs[job_id] = {
        "status": "pending",
        "step": "Waiting...",
        "segments": None,
        "original_filename": input_filename,
        "input_path": str(job_dir / "input.mp4"),
        "output_path": str(job_dir / "output.mp4"),
    }
    return job_id


def run_job(job_id: str, threshold: int, padding: int, min_silence: int) -> None:
    """Run silence removal in a background thread."""
    thread = threading.Thread(
        target=_process, args=(job_id, threshold, padding, min_silence), daemon=True
    )
    thread.start()


def _process(job_id: str, threshold: int, padding: int, min_silence: int) -> None:
    job = jobs[job_id]
    input_path = job["input_path"]
    output_path = job["output_path"]
    audio_path = str(JOBS_DIR / job_id / "audio.wav")

    try:
        extract_audio, detect_speaking_segments, build_trimmed_video = _reload()

        job["status"] = "processing"

        # Step 1: Extract audio
        job["step"] = "Extracting audio..."
        extract_audio(input_path, audio_path)

        # Step 2: Detect segments
        job["step"] = "Detecting speech segments..."
        segments = detect_speaking_segments(audio_path, threshold, min_silence, padding)

        # Clean up temp audio
        Path(audio_path).unlink(missing_ok=True)

        if not segments:
            job["status"] = "error"
            job["step"] = "No speech detected. Try adjusting the threshold."
            return

        job["segments"] = len(segments)

        # Step 3: Build trimmed video
        job["step"] = "Building trimmed video..."
        build_trimmed_video(input_path, output_path, segments)

        # Calculate stats
        input_size = Path(input_path).stat().st_size / (1024 * 1024)
        output_size = Path(output_path).stat().st_size / (1024 * 1024)

        job["status"] = "done"
        job["step"] = "Complete!"
        job["input_size_mb"] = round(input_size, 1)
        job["output_size_mb"] = round(output_size, 1)

    except Exception as e:
        job["status"] = "error"
        job["step"] = f"Error: {str(e)}"


def cleanup_old_jobs(max_age_hours: int = 1) -> None:
    """Remove job directories older than max_age_hours."""
    import time
    now = time.time()
    for job_dir in JOBS_DIR.iterdir():
        if job_dir.is_dir() and (now - job_dir.stat().st_mtime) > max_age_hours * 3600:
            job_id = job_dir.name
            shutil.rmtree(job_dir, ignore_errors=True)
            jobs.pop(job_id, None)
