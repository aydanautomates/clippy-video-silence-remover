"""Job processor that wraps silence_remover.py functions."""

import sys
import uuid
import threading
import importlib
import tempfile
import subprocess
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


def create_batch_job(filenames: list[str]) -> str:
    job_id = uuid.uuid4().hex[:12]
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True)
    jobs[job_id] = {
        "status": "pending",
        "step": "Waiting...",
        "segments": None,
        "batch": True,
        "total_files": len(filenames),
        "current_file": 0,
        "original_filenames": filenames,
        "input_paths": [str(job_dir / f"input_{i}.mp4") for i in range(len(filenames))],
        "output_path": str(job_dir / "merged.mp4"),
        "input_size_mb": None,
        "output_size_mb": None,
    }
    return job_id


def run_job(
    job_id: str,
    threshold: int,
    start_padding: int,
    end_padding: int,
    min_silence: int,
    keyword: str = "",
) -> None:
    """Run silence removal in a background thread."""
    thread = threading.Thread(
        target=_process,
        args=(job_id, threshold, start_padding, end_padding, min_silence, keyword),
        daemon=True,
    )
    thread.start()


def run_batch_job(
    job_id: str,
    threshold: int,
    start_padding: int,
    end_padding: int,
    min_silence: int,
    keyword: str = "",
) -> None:
    """Run batch silence removal + merge in a background thread."""
    thread = threading.Thread(
        target=_process_batch,
        args=(job_id, threshold, start_padding, end_padding, min_silence, keyword),
        daemon=True,
    )
    thread.start()


def _process(
    job_id: str,
    threshold: int,
    start_padding: int,
    end_padding: int,
    min_silence: int,
    keyword: str = "",
) -> None:
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
        segments = detect_speaking_segments(
            audio_path, threshold, min_silence, start_padding, end_padding
        )

        if segments and keyword.strip():
            job["step"] = "Detecting bad takes..."
            from bad_take_filter import filter_bad_takes
            segments = filter_bad_takes(audio_path, segments, keyword)

        # Clean up temp audio
        Path(audio_path).unlink(missing_ok=True)

        if not segments:
            job["status"] = "error"
            job["step"] = "No speech detected. Try adjusting the threshold."
            return

        job["segments"] = len(segments)

        # Step 3: Build trimmed video (keep individual segments for timeline export)
        job["step"] = "Building trimmed video..."
        segments_dir = str(JOBS_DIR / job_id / "segments")
        saved_segs = build_trimmed_video(input_path, output_path, segments, keep_segments_dir=segments_dir)

        # Store segment file info for download
        job["segment_files"] = [
            {"path": p, "size_mb": round(Path(p).stat().st_size / (1024 * 1024), 2)}
            for p in saved_segs
        ]

        # Calculate stats
        input_size = Path(input_path).stat().st_size / (1024 * 1024)
        output_size = Path(output_path).stat().st_size / (1024 * 1024)

        # Delete input file — no longer needed
        Path(input_path).unlink(missing_ok=True)

        job["status"] = "done"
        job["step"] = "Complete!"
        job["input_size_mb"] = round(input_size, 1)
        job["output_size_mb"] = round(output_size, 1)

    except Exception as e:
        job["status"] = "error"
        job["step"] = f"Error: {str(e)}"


def _process_batch(
    job_id: str,
    threshold: int,
    start_padding: int,
    end_padding: int,
    min_silence: int,
    keyword: str = "",
) -> None:
    job = jobs[job_id]
    input_paths = job["input_paths"]
    output_path = job["output_path"]
    job_dir = JOBS_DIR / job_id
    total = job["total_files"]
    total_segments = 0

    try:
        extract_audio, detect_speaking_segments, build_trimmed_video = _reload()

        job["status"] = "processing"
        trimmed_paths = []
        total_input_bytes = 0

        # Process each video individually
        for i, input_path in enumerate(input_paths):
            file_num = i + 1
            job["current_file"] = file_num

            total_input_bytes += Path(input_path).stat().st_size

            # Extract audio
            job["step"] = f"Video {file_num}/{total}: Extracting audio..."
            audio_path = str(job_dir / f"audio_{i}.wav")
            extract_audio(input_path, audio_path)

            # Detect segments
            job["step"] = f"Video {file_num}/{total}: Detecting speech..."
            segments = detect_speaking_segments(
                audio_path, threshold, min_silence, start_padding, end_padding
            )

            if segments and keyword.strip():
                job["step"] = f"Video {file_num}/{total}: Detecting bad takes..."
                from bad_take_filter import filter_bad_takes
                segments = filter_bad_takes(audio_path, segments, keyword)

            Path(audio_path).unlink(missing_ok=True)

            if not segments:
                job["step"] = f"Video {file_num}/{total}: No speech detected, skipping..."
                Path(input_path).unlink(missing_ok=True)
                continue

            total_segments += len(segments)
            job["segments"] = total_segments

            # Build trimmed version (keep segments for timeline export)
            trimmed_path = str(job_dir / f"trimmed_{i}.mp4")
            segments_dir = str(job_dir / f"segments_{i}")
            job["step"] = f"Video {file_num}/{total}: Trimming silence..."
            saved_segs = build_trimmed_video(input_path, trimmed_path, segments, keep_segments_dir=segments_dir)
            trimmed_paths.append((trimmed_path, job["original_filenames"][i], saved_segs))

            # Delete input file — no longer needed
            Path(input_path).unlink(missing_ok=True)

        if not trimmed_paths:
            job["status"] = "error"
            job["step"] = "No speech detected in any video. Try adjusting the threshold."
            return

        # Store individual trimmed file info for per-clip downloads
        job["trimmed_files"] = []
        all_segment_files: list[str] = []
        for path, orig_name, saved_segs in trimmed_paths:
            size = Path(path).stat().st_size / (1024 * 1024)
            job["trimmed_files"].append({
                "path": path,
                "original_filename": orig_name,
                "size_mb": round(size, 1),
            })
            all_segment_files.extend(saved_segs)

        # Store all segment files across all videos for timeline export
        job["segment_files"] = [
            {"path": p, "size_mb": round(Path(p).stat().st_size / (1024 * 1024), 2)}
            for p in all_segment_files
        ]

        # Merge all trimmed videos
        all_paths = [p for p, _, _ in trimmed_paths]
        if len(all_paths) == 1:
            shutil.copy2(all_paths[0], output_path)
        else:
            job["step"] = "Merging all videos..."
            _merge_videos(all_paths, output_path, str(job_dir))

        # Calculate stats
        total_input = total_input_bytes / (1024 * 1024)
        output_size = Path(output_path).stat().st_size / (1024 * 1024)

        job["status"] = "done"
        job["step"] = "Complete!"
        job["input_size_mb"] = round(total_input, 1)
        job["output_size_mb"] = round(output_size, 1)

    except Exception as e:
        job["status"] = "error"
        job["step"] = f"Error: {str(e)}"


def _merge_videos(video_paths: list[str], output_path: str, tmpdir: str) -> None:
    """Concatenate multiple trimmed MP4s into one using FFmpeg concat demuxer."""
    # Convert each to .ts for seamless concat
    ts_paths = []
    for i, path in enumerate(video_paths):
        ts_path = f"{tmpdir}/merge_{i}.ts"
        subprocess.run(
            ["ffmpeg", "-y", "-i", path,
             "-c", "copy",
             "-avoid_negative_ts", "make_zero",
             ts_path],
            check=True, capture_output=True,
        )
        ts_paths.append(ts_path)

    # Write concat file
    concat_file = f"{tmpdir}/merge_concat.txt"
    with open(concat_file, "w") as f:
        for ts_path in ts_paths:
            f.write(f"file '{ts_path}'\n")

    # Merge
    subprocess.run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0",
         "-i", concat_file,
         "-c", "copy",
         "-movflags", "+faststart",
         output_path],
        check=True, capture_output=True,
    )


def cleanup_old_jobs(max_age_hours: int = 1) -> None:
    """Remove job directories older than max_age_hours."""
    import time
    now = time.time()
    for job_dir in JOBS_DIR.iterdir():
        if job_dir.is_dir() and (now - job_dir.stat().st_mtime) > max_age_hours * 3600:
            job_id = job_dir.name
            shutil.rmtree(job_dir, ignore_errors=True)
            jobs.pop(job_id, None)
