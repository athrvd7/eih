import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.services import database
from app.services.job_manager import job_manager
from app.services.sse_manager import sse_manager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/{job_id}")
async def get_job_status(job_id: str):
    """Return current status and metadata for a job."""
    job = job_manager.get_job(job_id)
    if job:
        return {
            "job_id": job.job_id,
            "status": job.status.value,
            "repo_id": job.repo_id,
            "repo_name": job.repo_name,
            "error": job.error,
            "has_graph": job.graph is not None,
            "has_walkthrough": job.walkthrough is not None,
            "has_docs": job.docs is not None,
            "collection_name": job.collection_name,
        }

    # Fall back to the database for jobs that outlived the current process
    db_job = await database.get_job(job_id)
    if not db_job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return db_job


@router.get("/{job_id}/events")
async def job_events(job_id: str):
    """
    SSE stream that emits progress events while a pipeline is running.
    If the job is already in a terminal state, a single status event is
    sent immediately so the client can update its UI without polling.
    """
    queue = sse_manager.get_queue(job_id)

    if not queue:
        job = job_manager.get_job(job_id)
        if job and job.status.value in ("ready", "failed"):
            # Already done — send a single synthetic event and close
            async def _done_stream():
                event_status = (
                    "complete" if job.status.value == "ready" else "failed"
                )
                yield (
                    f"data: {json.dumps({'stage': 'pipeline', 'status': event_status, 'progress': 1.0})}\n\n"
                )

            return StreamingResponse(
                _done_stream(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "X-Accel-Buffering": "no",
                    "Connection": "keep-alive",
                },
            )

        # Reconnect case — recreate the queue so the generator doesn't immediately error
        sse_manager.create_queue(job_id)

    return StreamingResponse(
        sse_manager.event_generator(job_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
