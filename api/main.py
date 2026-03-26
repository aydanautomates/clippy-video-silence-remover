"""FastAPI backend for Video Auto-Clipper."""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
import shutil

from processor import jobs, create_job, run_job, cleanup_old_jobs

app = FastAPI(title="Video Auto-Clipper API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_UPLOAD_MB = 2000


@app.post("/api/upload")
async def upload_video(
    file: UploadFile = File(...),
    threshold: int = Form(-35),
    padding: int = Form(100),
    min_silence: int = Form(300),
):
    if not file.filename:
        raise HTTPException(400, "No file provided")

    # Clean up old jobs on each upload
    cleanup_old_jobs()

    job_id = create_job(file.filename)
    job = jobs[job_id]

    # Save uploaded file to disk
    with open(job["input_path"], "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_size_mb = Path(job["input_path"]).stat().st_size / (1024 * 1024)
    if file_size_mb > MAX_UPLOAD_MB:
        Path(job["input_path"]).unlink()
        jobs.pop(job_id, None)
        raise HTTPException(413, f"File too large ({file_size_mb:.0f}MB). Max is {MAX_UPLOAD_MB}MB.")

    # Start processing in background
    run_job(job_id, threshold, padding, min_silence)

    return {"job_id": job_id}


@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(404, "Job not found")

    job = jobs[job_id]
    return {
        "status": job["status"],
        "step": job["step"],
        "segments": job["segments"],
        "input_size_mb": job.get("input_size_mb"),
        "output_size_mb": job.get("output_size_mb"),
    }


@app.get("/api/download/{job_id}")
async def download_video(job_id: str):
    if job_id not in jobs:
        raise HTTPException(404, "Job not found")

    job = jobs[job_id]
    if job["status"] != "done":
        raise HTTPException(400, "Video not ready yet")

    output_path = Path(job["output_path"])
    if not output_path.exists():
        raise HTTPException(404, "Output file not found")

    original = job["original_filename"]
    stem = Path(original).stem
    download_name = f"{stem}_trimmed.mp4"

    return FileResponse(
        path=str(output_path),
        filename=download_name,
        media_type="video/mp4",
    )
