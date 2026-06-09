"""
Docs router — lazily generates and returns onboarding documentation.
"""
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models.onboarding import OnboardingDoc
from app.services.job_manager import job_manager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/{job_id}", response_model=OnboardingDoc)
async def get_docs(job_id: str):
    """
    Return (or lazily generate) the onboarding documentation for a completed job.
    Generation may take 30–120 s on first call due to multi-section LLM scribing.
    """
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if job.status.value not in ("ready", "scribing"):
        raise HTTPException(
            status_code=409,
            detail=f"Job is not ready (status: {job.status.value})",
        )

    try:
        docs = await job_manager.generate_docs(job_id)
        return docs
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


class UpdateDocsRequest(BaseModel):
    sections: list


@router.put("/{job_id}")
async def update_docs(job_id: str, request: UpdateDocsRequest):
    """Save inline-edited onboarding documentation."""
    from app.models.onboarding import DocSection
    from app.services import database

    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    if not job.docs:
        raise HTTPException(status_code=404, detail="No docs found for this job")

    job.docs.sections = [DocSection(**s) for s in request.sections]
    await database.save_docs(job_id, job.docs.model_dump_json())
    return {"status": "saved"}
