#!/usr/bin/env python3
"""Remove silence from video files using FFmpeg and pydub."""

import argparse
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


def _normalize_video(video_path: str, normalized_path: str) -> None:
    """Re-encode video to H.264/AAC MP4 so segment cuts work cleanly."""
    encoder = _get_video_encoder()
    subprocess.run(
        ["ffmpeg", "-y", "-i", video_path,
         "-map", "0:v:0", "-map", "0:a:0",
         *encoder,
         "-c:a", "aac", "-b:a", "192k",
         "-movflags", "+faststart",
         normalized_path],
        check=True, capture_output=True,
    )


def build_trimmed_video(
    video_path: str, output_path: str, segments: list[tuple[int, int]]
) -> None:
    """Build trimmed video by normalizing, cutting segments with stream copy, and concatenating."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Step 1: Normalize to H.264/AAC so stream-copy cuts work cleanly
        normalized = str(Path(tmpdir) / "normalized.mp4")
        _normalize_video(video_path, normalized)

        # Step 2: Cut each segment with stream copy (preserves exact A/V sync)
        seg_files = []
        for i, (start_ms, end_ms) in enumerate(segments):
            seg_file = str(Path(tmpdir) / f"seg_{i:04d}.mp4")
            start_s = start_ms / 1000
            duration_s = (end_ms - start_ms) / 1000
            subprocess.run(
                ["ffmpeg", "-y",
                 "-ss", f"{start_s:.3f}",
                 "-i", normalized,
                 "-t", f"{duration_s:.3f}",
                 "-c", "copy",
                 "-avoid_negative_ts", "make_zero",
                 seg_file],
                check=True, capture_output=True,
            )
            seg_files.append(seg_file)

        # Step 3: Concatenate segments with concat demuxer (no re-encode)
        concat_file = str(Path(tmpdir) / "concat.txt")
        with open(concat_file, "w") as f:
            for seg_file in seg_files:
                f.write(f"file '{seg_file}'\n")

        subprocess.run(
            ["ffmpeg", "-y", "-f", "concat", "-safe", "0",
             "-i", concat_file,
             "-c", "copy",
             "-movflags", "+faststart",
             output_path],
            check=True, capture_output=True,
        )


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
