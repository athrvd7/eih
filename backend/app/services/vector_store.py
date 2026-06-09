import logging

import chromadb

from app.config import get_settings

logger = logging.getLogger(__name__)


class VectorStore:
    """Thin wrapper around a ChromaDB client with batched upsert helpers."""

    def __init__(self):
        self.settings = get_settings()
        self._client: chromadb.ClientAPI | None = None

    @property
    def client(self) -> chromadb.ClientAPI:
        """
        Lazily build the ChromaDB client.
        Falls back to an in-memory client if the HTTP server is unreachable,
        so the rest of the pipeline can still run during development.
        """
        if self._client is None:
            try:
                self._client = chromadb.HttpClient(
                    host=self.settings.chroma_host,
                    port=self.settings.chroma_port,
                )
                # Probe the connection eagerly
                self._client.heartbeat()
                logger.info(
                    "Connected to ChromaDB at %s:%s",
                    self.settings.chroma_host,
                    self.settings.chroma_port,
                )
            except Exception as exc:
                logger.warning(
                    "ChromaDB HTTP client unavailable (%s). Falling back to in-memory client.",
                    exc,
                )
                self._client = chromadb.Client()
        return self._client

    def get_or_create_collection(self, name: str):
        return self.client.get_or_create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"},
        )

    def collection_exists(self, name: str) -> bool:
        try:
            self.client.get_collection(name)
            return True
        except Exception:
            return False

    def add_chunks(
        self,
        collection_name: str,
        ids: list[str],
        documents: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
    ) -> None:
        """Upsert chunks into ChromaDB in batches of 100."""
        collection = self.get_or_create_collection(collection_name)
        batch_size = 100
        for i in range(0, len(ids), batch_size):
            collection.add(
                ids=ids[i : i + batch_size],
                documents=documents[i : i + batch_size],
                embeddings=embeddings[i : i + batch_size],
                metadatas=metadatas[i : i + batch_size],
            )

    def query(
        self,
        collection_name: str,
        query_embedding: list[float],
        n_results: int = 5,
        where: dict | None = None,
    ) -> dict:
        collection = self.get_or_create_collection(collection_name)
        kwargs: dict = {
            "query_embeddings": [query_embedding],
            "n_results": n_results,
            "include": ["documents", "metadatas", "distances"],
        }
        if where:
            kwargs["where"] = where
        return collection.query(**kwargs)

    def delete_collection(self, name: str) -> None:
        try:
            self.client.delete_collection(name)
        except Exception:
            pass


# Module-level singleton
vector_store = VectorStore()
