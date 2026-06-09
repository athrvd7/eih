"""
Graph router — returns the dependency graph for a completed job.
"""
import logging

from fastapi import APIRouter, HTTPException

from app.models.graph import DependencyGraph
from app.services import database
from app.services.job_manager import job_manager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/{job_id}", response_model=DependencyGraph)
async def get_graph(job_id: str):
    """Return the dependency graph for a completed ingestion job."""
    job = job_manager.get_job(job_id)

    if job and job.graph:
        return job.graph

    # Try DB cache
    graph_json = await database.get_graph(job_id)
    if graph_json:
        return DependencyGraph.model_validate_json(graph_json)

    if job and job.status.value not in ("ready", "failed"):
        raise HTTPException(status_code=202, detail="Pipeline still running")

    raise HTTPException(status_code=404, detail=f"Graph for job {job_id} not found")


@router.get("/{job_id}/node/{node_id:path}")
async def get_node_details(job_id: str, node_id: str):
    """Get details for a specific node, including AI-generated summary on demand."""
    job = job_manager.get_job(job_id)

    # Resolve graph
    if job and job.graph:
        graph = job.graph
    else:
        graph_json = await database.get_graph(job_id)
        if not graph_json:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
        graph = DependencyGraph.model_validate_json(graph_json)
        if job:
            job.graph = graph

    node = next((n for n in graph.nodes if n.id == node_id), None)
    if not node:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found in graph")

    deps = [e.target for e in graph.edges if e.source == node_id]
    dependents = [e.source for e in graph.edges if e.target == node_id]

    # Code snippet from chunks
    code_snippet = ""
    if job and job.chunks:
        file_chunks = [c for c in job.chunks.chunks if c.file_path == node_id]
        code_snippet = "\n".join(c.content for c in file_chunks[:3])[:2000]

    # Lazy AI summary
    if not node.summary and code_snippet:
        try:
            from app.services.gemini_client import gemini_client
            prompt = (
                f"In 2-3 sentences, explain what this file does in the {graph.repo_name} codebase:\n\n"
                f"File: {node_id}\nType: {node.type.value}\n\nCode:\n{code_snippet[:1500]}"
            )
            node.summary = await gemini_client.generate(prompt)
        except Exception as e:
            logger.warning(f"Failed to generate summary for {node_id}: {e}")

    return {
        "node": node.model_dump(),
        "dependencies": deps,
        "dependents": dependents,
        "code_snippet": code_snippet,
        "file_path": node_id,
    }
