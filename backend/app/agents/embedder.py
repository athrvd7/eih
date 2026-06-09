import asyncio
import logging

from app.agents.base import BaseAgent
from app.models.chunk import ChunkList
from app.services.gemini_client import gemini_client
from app.services.vector_store import vector_store

logger = logging.getLogger(__name__)

BATCH_SIZE = 10
BATCH_DELAY = 4.0  # seconds between batches to respect Gemini rate limits


class Embedder(BaseAgent):
    """
    EMBEDDER agent.

    Takes a ChunkList, embeds every chunk via the Gemini embedding API, and
    stores the resulting vectors in ChromaDB.  Returns the collection name.
    """

    async def execute(self, chunk_list: ChunkList) -> str:
        """Embed all chunks and store them in ChromaDB.  Returns collection_name."""
        collection_name = f"code_{chunk_list.repo_id}"
        chunks = chunk_list.chunks
        total = len(chunks)

        if total == 0:
            logger.warning("Embedder: chunk list is empty — nothing to embed.")
            return collection_name

        await self.report_progress(0.0, f"Embedding {total} chunks...")

        for batch_start in range(0, total, BATCH_SIZE):
            batch = chunks[batch_start : batch_start + BATCH_SIZE]

            ids: list[str] = []
            documents: list[str] = []
            metadatas: list[dict] = []

            for chunk in batch:
                ids.append(chunk.id)
                documents.append(chunk.content)
                metadatas.append(
                    {
                        "file_path": chunk.file_path,
                        "chunk_type": chunk.chunk_type.value,
                        "name": chunk.name,
                        "language": chunk.language,
                        "start_line": chunk.start_line,
                        "end_line": chunk.end_line,
                        "parent_class": chunk.parent_class or "",
                        "repo_id": chunk_list.repo_id,
                    }
                )

            try:
                embeddings = await gemini_client.embed_batch(
                    documents, task_type="RETRIEVAL_DOCUMENT"
                )
                vector_store.add_chunks(
                    collection_name=collection_name,
                    ids=ids,
                    documents=documents,
                    embeddings=embeddings,
                    metadatas=metadatas,
                )
                completed = min(batch_start + BATCH_SIZE, total)
                progress = completed / total
                await self.report_progress(
                    progress, f"Embedded {completed}/{total} chunks"
                )

            except Exception as exc:
                logger.error(
                    "Embedding batch %d–%d failed: %s",
                    batch_start,
                    batch_start + BATCH_SIZE,
                    exc,
                )
                # Continue with the next batch rather than aborting entirely

            # Throttle between batches (skip delay after the last one)
            if batch_start + BATCH_SIZE < total:
                await asyncio.sleep(BATCH_DELAY)

        return collection_name
