import asyncio
import json
import logging
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from app.models.chunk import ChunkList
from app.models.graph import DependencyGraph
from app.models.manifest import FileManifest
from app.models.onboarding import OnboardingDoc
from app.models.walkthrough import Walkthrough
from app.services import database
from app.services.sse_manager import sse_manager

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    PENDING = "pending"
    INGESTING = "ingesting"
    CHUNKING = "chunking"
    EMBEDDING = "embedding"
    GRAPHING = "graphing"
    READY = "ready"
    NARRATING = "narrating"
    SCRIBING = "scribing"
    FAILED = "failed"


@dataclass
class Job:
    job_id: str
    status: JobStatus = JobStatus.PENDING
    repo_id: str = ""
    repo_name: str = ""
    source_type: str = ""
    source: str = ""
    collection_name: Optional[str] = None
    manifest: Optional[FileManifest] = None
    chunks: Optional[ChunkList] = None
    graph: Optional[DependencyGraph] = None
    walkthrough: Optional[Walkthrough] = None
    docs: Optional[OnboardingDoc] = None
    error: Optional[str] = None


class JobManager:
    """
    Owns all in-flight and recently-completed Job objects.
    Orchestrates the multi-agent pipeline and provides lazy generation
    of walkthroughs and onboarding docs.
    """

    def __init__(self):
        self.jobs: dict[str, Job] = {}

    async def create_job(self, source_type: str, source: str) -> str:
        job_id = str(uuid.uuid4())
        job = Job(
            job_id=job_id,
            status=JobStatus.PENDING,
            source_type=source_type,
            source=source if isinstance(source, str) else "",
        )
        self.jobs[job_id] = job

        sse_manager.create_queue(job_id)
        await database.save_job(
            job_id=job_id,
            status=JobStatus.PENDING.value,
            source_type=source_type,
            source=source if isinstance(source, str) else "",
        )

        return job_id

    def get_job(self, job_id: str) -> Optional[Job]:
        return self.jobs.get(job_id)

    async def start_pipeline(self, job_id: str, source_type: str, source) -> None:
        """
        Run the full INGESTOR → CHUNKER → [EMBEDDER ∥ GRAPHER] pipeline.

        All inter-agent hand-offs are done in-memory; only final artefacts
        (graph JSON, collection name, status) are persisted to the DB.
        """
        # Lazy imports keep circular-import risk low and mean the heavy
        # tree-sitter initialisation happens only when a job actually starts.
        from app.agents.chunker import Chunker
        from app.agents.embedder import Embedder
        from app.agents.grapher import Grapher
        from app.agents.ingestor import Ingestor

        job = self.jobs.get(job_id)
        if not job:
            return

        try:
            # ---- Stage 1: INGEST ----
            job.status = JobStatus.INGESTING
            await database.update_job(job_id, status=JobStatus.INGESTING.value)
            await sse_manager.emit(
                job_id, "pipeline", "running", 0.1, "Ingesting repository..."
            )

            ingestor = Ingestor(job_id)
            manifest = await ingestor.run(source_type=source_type, source=source)
            job.manifest = manifest
            job.repo_id = manifest.repo_id
            job.repo_name = manifest.repo_name
            await database.update_job(
                job_id,
                repo_id=manifest.repo_id,
                repo_name=manifest.repo_name,
            )

            # ---- Stage 2: CHUNK ----
            job.status = JobStatus.CHUNKING
            await database.update_job(job_id, status=JobStatus.CHUNKING.value)
            await sse_manager.emit(
                job_id, "pipeline", "running", 0.3, "Chunking source code..."
            )

            chunker = Chunker(job_id)
            chunks = await chunker.run(manifest=manifest)
            job.chunks = chunks

            # ---- Stage 3: EMBED + GRAPH (parallel) ----
            job.status = JobStatus.EMBEDDING
            await database.update_job(job_id, status=JobStatus.EMBEDDING.value)
            await sse_manager.emit(
                job_id, "pipeline", "running", 0.5, "Embedding and graphing..."
            )

            embedder = Embedder(job_id)
            grapher = Grapher(job_id)

            collection_name, graph = await asyncio.gather(
                embedder.run(chunk_list=chunks),
                grapher.run(manifest=manifest),
                return_exceptions=True,
            )

            # Handle partial failures gracefully
            if isinstance(collection_name, Exception):
                logger.error("Embedder failed: %s", collection_name)
                collection_name = None
            if isinstance(graph, Exception):
                logger.error("Grapher failed: %s", graph)
                graph = None

            job.collection_name = collection_name
            job.graph = graph

            if graph:
                await database.save_graph(job_id, graph.model_dump_json())
            if collection_name:
                await database.update_job(job_id, collection_name=collection_name)

            # ---- Done ----
            job.status = JobStatus.READY
            await database.update_job(job_id, status=JobStatus.READY.value)
            await sse_manager.emit(
                job_id, "pipeline", "complete", 1.0, "Repository ready!"
            )
            await sse_manager.close_queue(job_id)

        except Exception as exc:
            logger.exception("Pipeline failed for job %s: %s", job_id, exc)
            job.status = JobStatus.FAILED
            job.error = str(exc)
            await database.update_job(
                job_id, status=JobStatus.FAILED.value, error=str(exc)
            )
            await sse_manager.emit(job_id, "pipeline", "failed", error=str(exc))
            await sse_manager.close_queue(job_id)

    async def generate_walkthrough(self, job_id: str) -> Walkthrough:
        """Lazily generate (or return cached) a code walkthrough for the given job."""
        from app.agents.narrator import Narrator

        job = self.jobs.get(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")

        if job.walkthrough:
            return job.walkthrough

        # Check DB cache first
        cached = await database.get_walkthrough(job_id)
        if cached:
            wt = Walkthrough.model_validate_json(cached)
            job.walkthrough = wt
            return wt

        if not job.graph or not job.chunks:
            raise ValueError(f"Job {job_id} pipeline not complete")

        job.status = JobStatus.NARRATING
        narrator = Narrator(job_id)
        walkthrough = await narrator.run(graph=job.graph, chunks=job.chunks)
        job.walkthrough = walkthrough

        await database.save_walkthrough(job_id, walkthrough.model_dump_json())
        job.status = JobStatus.READY
        return walkthrough

    async def generate_docs(self, job_id: str) -> OnboardingDoc:
        """Lazily generate (or return cached) onboarding docs for the given job."""
        from app.agents.scribe import Scribe

        job = self.jobs.get(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")

        if job.docs:
            return job.docs

        cached = await database.get_docs(job_id)
        if cached:
            docs = OnboardingDoc.model_validate_json(cached)
            job.docs = docs
            return docs

        if not job.graph or not job.chunks:
            raise ValueError(f"Job {job_id} pipeline not complete")

        job.status = JobStatus.SCRIBING
        scribe = Scribe(job_id)
        readme = job.manifest.readme_content if job.manifest else None
        docs = await scribe.run(graph=job.graph, chunks=job.chunks, readme=readme)
        job.docs = docs

        await database.save_docs(job_id, docs.model_dump_json())
        job.status = JobStatus.READY
        return docs

    async def restore_from_db(self) -> None:
        """
        On startup, reload completed jobs from the DB so that results remain
        accessible after a server restart without re-running the pipeline.

        (MVP: status restoration only — manifests/chunks stay in-memory only.)
        """
        pass  # Full restore implementation deferred to a subsequent task.


# Module-level singleton
job_manager = JobManager()
