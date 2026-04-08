#!/usr/bin/env python3
"""Remove silence from video files using FFmpeg and pydub."""

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from pydub import AudioSegment
from pydub.silence import detect_nonsilent


def extract_audio(video_path: str, audio_path: str) -> None:
    """Extract audio from video file as WAV."""
    subprocess.run(
        ["ffmpeg", "-y", "-i", video_path, "-vn", "-acodec", "pcm_s16le",
         "-ar", "16000", "-ac", "1", audio_path],
        check=True, capture_output=True,
    )


def detect_speaking_segments(
    audio_path: str, silence_thresh: int, min_silence_len: int = 300, padding: int = 100
) -> list[tuple[int, int]]:
    """Detect non-silent segments in audio. Returns list of (start_ms, end_ms)."""
    audio = AudioSegment.from_wav(audio_path)
    segments = detect_nonsilent(
        audio,
        min_silence_len=min_silence_len,
        silence_thresh=silence_thresh,
    )

    if not segments:
        print("Warning: No speech detected. Check your threshold value.")
        return []

    # Apply padding
    duration_ms = len(audio)
    padded = []
    for start, end in segments:
        padded.append((
            max(0, start - padding),
            min(duration_ms, end + padding),
        ))

    # Merge overlapping segments
    merged = [padded[0]]
    for start, end in padded[1:]:
        if start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))

    return merged


def _get_video_encoder() -> list[str]:
    """Pick the best available H.264 encoder for this platform."""
    import platform
    if platform.system() == "Darwin":
        return ["-c:v", "h264_videotoolbox", "-q:v", "65"]
    try:
        result = subprocess.run(
            ["ffmpeg", "-encoders"], capture_output=True, text=True
        )
        if "h264_nvenc" in result.stdout:
            return ["-c:v", "h264_nvenc", "-cq", "23"]
    except Exception:
        pass
    return ["-c:v", "libx264", "-preset", "fast", "-crf", "18"]


def build_trimmed_video(
    video_path: str, output_path: str, segments: list[tuple[int, int]],
    keep_segments_dir: str | None = None,
) -> list[str]:
    """Build trimmed video by re-encoding each segment and concatenating via MPEG-TS.

    Each segment is independently encoded from the original, giving frame-accurate
    cuts with perfect A/V sync. TS intermediate concat avoids AAC stutter at boundaries.

    If keep_segments_dir is provided, numbered segment files (001.mp4, 002.mp4, ...)
    are saved there for individual download. Returns list of saved segment paths.
    """
    encoder = _get_video_encoder()

    with tempfile.TemporaryDirectory() as tmpdir:
        # Step 1: Cut and re-encode each segment (frame-accurate, no keyframe issues)
        seg_files = []
        for i, (start_ms, end_ms) in enumerate(segments):
            seg_file = str(Path(tmpdir) / f"seg_{i:04d}.mp4")
            start_s = start_ms / 1000
            duration_s = (end_ms - start_ms) / 1000
            subprocess.run(
                ["ffmpeg", "-y",
                 "-ss", f"{start_s:.3f}",
                 "-i", video_path,
                 "-t", f"{duration_s:.3f}",
                 "-map", "0:v:0", "-map", "0:a:0",
                 *encoder,
                 "-c:a", "aac", "-b:a", "192k",
                 "-avoid_negative_ts", "make_zero",
                 "-movflags", "+faststart",
                 seg_file],
                check=True, capture_output=True,
            )
            seg_files.append(seg_file)

        # Step 2: Save numbered segments if requested
        saved_segments: list[str] = []
        if keep_segments_dir:
            Path(keep_segments_dir).mkdir(parents=True, exist_ok=True)
            for i, seg_file in enumerate(seg_files):
                dest = str(Path(keep_segments_dir) / f"{i + 1:03d}.mp4")
                shutil.copy2(seg_file, dest)
                saved_segments.append(dest)

        # Step 3: Convert segments to MPEG-TS for seamless concatenation
        # (MP4 concat has AAC frame alignment issues that cause stutter)
        ts_files = []
        for i, seg_file in enumerate(seg_files):
            ts_file = str(Path(tmpdir) / f"seg_{i:04d}.ts")
            subprocess.run(
                ["ffmpeg", "-y", "-i", seg_file,
                 "-c", "copy",
                 "-bsf:v", "h264_mp4toannexb",
                 "-f", "mpegts",
                 ts_file],
                check=True, capture_output=True,
            )
            ts_files.append(ts_file)

        # Step 4: Concatenate .ts files and mux back to MP4
        concat_file = str(Path(tmpdir) / "concat.txt")
        with open(concat_file, "w") as f:
            for ts_file in ts_files:
                f.write(f"file '{ts_file}'\n")

        subprocess.run(
            ["ffmpeg", "-y", "-f", "concat", "-safe", "0",
             "-i", concat_file,
             "-c", "copy",
             "-bsf:a", "aac_adtstoasc",
             "-movflags", "+faststart",
             output_path],
            check=True, capture_output=True,
        )

    return saved_segments


def main():
    parser = argparse.ArgumentParser(
        description="Remove silence from video files."
    )
    parser.add_argument("input", help="Input video file path")
    parser.add_argument("output", help="Output video file path")
    parser.add_argument(
        "--threshold", type=int, default=-35,
        help="Silence threshold in dB (default: -35)"
    )
    parser.add_argument(
        "--padding", type=int, default=100,
        help="Padding in ms around each cut (default: 100)"
    )
    parser.add_argument(
        "--min-silence", type=int, default=300,
        help="Minimum silence duration in ms to detect (default: 300)"
    )
    args = parser.parse_args()

    if not Path(args.input).is_file():
        print(f"Error: Input file '{args.input}' not found.")
        sys.exit(1)

    print(f"Processing: {args.input}")
    print(f"Threshold: {args.threshold}dB | Padding: {args.padding}ms | Min silence: {args.min_silence}ms")

    # Step 1: Extract audio
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        audio_path = tmp.name

    print("Extracting audio...")
    extract_audio(args.input, audio_path)

    # Step 2: Detect speech segments
    print("Detecting speech segments...")
    segments = detect_speaking_segments(
        audio_path, args.threshold, args.min_silence, args.padding
    )

    Path(audio_path).unlink(missing_ok=True)

    if not segments:
        print("No segments found. Exiting.")
        sys.exit(1)

    total_kept = sum(end - start for start, end in segments) / 1000
    print(f"Found {len(segments)} speech segments ({total_kept:.1f}s total)")

    # Step 3: Build trimmed video
    print("Building trimmed video...")
    build_trimmed_video(args.input, args.output, segments)

    input_size = Path(args.input).stat().st_size / (1024 * 1024)
    output_size = Path(args.output).stat().st_size / (1024 * 1024)
    print(f"Done! {input_size:.1f}MB -> {output_size:.1f}MB")
    print(f"Output saved to: {args.output}")


if __name__ == "__main__":
    main()
