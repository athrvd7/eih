"""
Walkthrough router — lazily generates and returns a step-by-step code walkthrough.
"""
import logging

from fastapi import APIRouter, HTTPException

from app.models.walkthrough import Walkthrough
from app.services.job_manager import job_manager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/{job_id}", response_model=Walkthrough)
async def get_walkthrough(job_id: str):
    """
    Return (or lazily generate) the walkthrough for a completed job.
    Generation may take 30–90 s on first call due to LLM narration.
    """
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if job.status.value not in ("ready", "narrating"):
        raise HTTPException(
            status_code=409,
            detail=f"Job is not ready (status: {job.status.value})",
        )

    try:
        walkthrough = await job_manager.generate_walkthrough(job_id)
        return walkthrough
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
