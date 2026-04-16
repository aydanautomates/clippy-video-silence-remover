"""Bad-take keyword filtering via faster-whisper.

When the user says a keyword phrase at the end of a bad take (default: "cut that
take"), this module transcribes the full audio, locates each occurrence of the
keyword, and drops the speech segment containing it plus the segment immediately
before it. That handles the natural pattern where the keyword lands in its own
segment after a pause.

faster_whisper is lazy-imported so callers who never set a keyword pay no cost.
"""

from __future__ import annotations


def filter_bad_takes(
    audio_path: str,
    segments: list[tuple[int, int]],
    keyword: str,
    model_size: str = "base",
) -> list[tuple[int, int]]:
    """Drop segments that contain the keyword, plus the segment immediately before.

    Args:
        audio_path: path to the mono 16kHz WAV extracted from the video.
        segments: list of (start_ms, end_ms) tuples from detect_speaking_segments.
        keyword: phrase to detect (case-insensitive substring match).
        model_size: faster-whisper model name. "base" is the default;
            "tiny" is faster but less accurate.

    Returns a filtered list with matching segments (and their immediate
    predecessor) removed. If no keyword matches are found, returns the input
    unchanged.
    """
    needle = keyword.lower().strip()
    if not needle or not segments:
        return segments

    from faster_whisper import WhisperModel

    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    whisper_segs, _info = model.transcribe(audio_path, vad_filter=False)

    keyword_times_ms: list[int] = []
    for seg in whisper_segs:
        text = (seg.text or "").lower()
        if needle in text:
            # Use the start of the whisper segment to locate it against our
            # silence-detected segments. It's close enough for mapping.
            keyword_times_ms.append(int(seg.start * 1000))

    if not keyword_times_ms:
        return segments

    to_remove: set[int] = set()
    for kt in keyword_times_ms:
        for i, (start_ms, end_ms) in enumerate(segments):
            if start_ms <= kt <= end_ms:
                to_remove.add(i)
                if i > 0:
                    to_remove.add(i - 1)
                break
        else:
            # Keyword fell in a gap between segments (shouldn't happen since
            # speech can't be detected outside speech segments, but guard
            # anyway). Find the nearest preceding segment and remove it.
            nearest = -1
            for i, (_start, end_ms) in enumerate(segments):
                if end_ms <= kt:
                    nearest = i
            if nearest >= 0:
                to_remove.add(nearest)

    return [seg for i, seg in enumerate(segments) if i not in to_remove]
