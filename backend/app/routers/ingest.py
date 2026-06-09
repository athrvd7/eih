import logging
import os

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import get_settings
from app.services.job_manager import job_manager

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()


class GitHubIngestRequest(BaseModel):
    url: str


@router.post("/github")
async def ingest_github(
    request: GitHubIngestRequest, background_tasks: BackgroundTasks
):
    """Submit a public GitHub repository URL for ingestion."""
    url = request.url.strip()

    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    if not url.startswith("https://github.com/"):
        raise HTTPException(
            status_code=400, detail="Only public GitHub URLs are supported"
        )

    job_id = await job_manager.create_job("github", url)
    background_tasks.add_task(job_manager.start_pipeline, job_id, "github", url)

    return {"job_id": job_id, "status": "pending"}


@router.post("/upload")
async def ingest_upload(
    background_tasks: BackgroundTasks, file: UploadFile = File(...)
):
    """Submit a ZIP archive for ingestion."""
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only ZIP files are supported")

    max_bytes = settings.max_upload_mb * 1024 * 1024

    os.makedirs(settings.repos_dir, exist_ok=True)
    tmp_path = os.path.join(settings.repos_dir, f"upload_{file.filename}")

    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds {settings.max_upload_mb} MB limit",
        )

    with open(tmp_path, "wb") as fh:
        fh.write(content)

    job_id = await job_manager.create_job("zip", tmp_path)
    background_tasks.add_task(job_manager.start_pipeline, job_id, "zip", tmp_path)

    return {"job_id": job_id, "status": "pending"}


@router.post("/docs")
async def ingest_docs(
    background_tasks: BackgroundTasks, files: list[UploadFile] = File(...)
):
    """Submit documentation files (.md, .txt, .rst) for ingestion."""
    allowed_exts = {".md", ".txt", ".rst"}
    doc_files: list[tuple[str, str]] = []

    for f in files:
        ext = os.path.splitext(f.filename or "")[1].lower()
        if ext not in allowed_exts:
            raise HTTPException(
                status_code=400,
                detail=f"File {f.filename!r} is not a supported documentation type",
            )
        raw = await f.read()
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=400,
                detail=f"File {f.filename!r} is not valid UTF-8",
            )
        doc_files.append((f.filename or "doc.md", text))

    job_id = await job_manager.create_job("docs", "documentation")
    background_tasks.add_task(
        job_manager.start_pipeline, job_id, "docs", doc_files
    )

    return {"job_id": job_id, "status": "pending"}
