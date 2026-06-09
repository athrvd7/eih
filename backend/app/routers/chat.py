import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.job_manager import job_manager
from app.services import database

router = APIRouter()
logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    question: str


@router.post("/{job_id}")
async def chat(job_id: str, request: ChatRequest):
    """Send a chat message and get a RAG-grounded response."""
    from app.agents.retriever import Retriever

    job = job_manager.get_job(job_id)

    if not job:
        raise HTTPException(404, f"Job {job_id} not found")

    if job.status.value not in ("ready", "narrating", "scribing"):
        raise HTTPException(202, f"Job not ready for chat: {job.status.value}")

    if not job.collection_name:
        raise HTTPException(
            422,
            "No vector store available for this job (embedding may have failed)",
        )

    if not request.question.strip():
        raise HTTPException(400, "Question cannot be empty")

    retriever = Retriever(job_id)

    try:
        response = await retriever.run(
            job_id=job_id,
            question=request.question.strip(),
            collection_name=job.collection_name,
            repo_name=job.repo_name,
        )
        return response.model_dump()
    except Exception as e:
        logger.exception(f"Chat failed for job {job_id}: {e}")
        raise HTTPException(500, f"Chat failed: {str(e)}")


@router.get("/{job_id}/history")
async def get_chat_history(job_id: str):
    """Get the chat history for a job."""
    history = await database.get_chat_history(job_id, limit=50)
    return {"messages": history}


@router.get("/{job_id}/suggestions")
async def get_suggestions(job_id: str):
    """Get suggested starter questions for the chat panel."""
    job = job_manager.get_job(job_id)

    if not job:
        raise HTTPException(404, f"Job {job_id} not found")

    suggestions = []
    if job.graph:
        entry_names = [
            n.label for n in job.graph.nodes
            if n.id in job.graph.entry_points
        ][:2]

        service_names = [
            n.label for n in job.graph.nodes
            if n.type.value == "service"
        ][:2]

        suggestions = [
            f"What does {entry_names[0]} do?" if entry_names else "What is the entry point of this codebase?",
            f"How is the {service_names[0]} structured?" if service_names else "What are the main services in this project?",
            "How does data flow through this application?",
            "What are the main design patterns used here?",
            (
                "How is authentication/authorization handled?"
                if any('auth' in n.id.lower() for n in job.graph.nodes)
                else "What are the key dependencies?"
            ),
        ]
    else:
        suggestions = [
            "What is this project about?",
            "What is the main entry point?",
            "How is the code organized?",
        ]

    return {"suggestions": suggestions[:5]}
