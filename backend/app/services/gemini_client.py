import asyncio
import logging

from google import genai
from google.genai import types

from app.config import get_settings
from app.utils.rate_limiter import rate_limiter

logger = logging.getLogger(__name__)


class GeminiClient:
    """Thin async wrapper around the google-genai SDK."""

    def __init__(self):
        self.settings = get_settings()
        self._client: genai.Client | None = None

    @property
    def client(self) -> genai.Client:
        """Lazily initialise the SDK client so the API key is read at first use."""
        if self._client is None:
            self._client = genai.Client(api_key=self.settings.gemini_api_key)
        return self._client

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        model: str = "gemini-2.5-flash",
    ) -> str:
        """
        Generate a text response for `prompt`.
        Applies the module-level rate limiter before each call.
        """
        await rate_limiter.acquire()

        def _generate() -> str:
            contents = [
                types.Content(role="user", parts=[types.Part(text=prompt)])
            ]
            config = types.GenerateContentConfig(
                system_instruction=system_prompt if system_prompt else None,
                temperature=0.3,
            )
            response = self.client.models.generate_content(
                model=model,
                contents=contents,
                config=config,
            )
            return response.text

        return await asyncio.to_thread(_generate)

    async def embed(
        self,
        text: str,
        task_type: str = "RETRIEVAL_DOCUMENT",
    ) -> list[float]:
        """
        Embed a single text string.
        Returns a 768-dimensional vector.
        """
        await rate_limiter.acquire()

        def _embed() -> list[float]:
            response = self.client.models.embed_content(
                model="gemini-embedding-001",
                contents=text,
                config=types.EmbedContentConfig(
                    task_type=task_type,
                    output_dimensionality=768,
                ),
            )
            return list(response.embeddings[0].values)

        return await asyncio.to_thread(_embed)

    async def embed_batch(
        self,
        texts: list[str],
        task_type: str = "RETRIEVAL_DOCUMENT",
    ) -> list[list[float]]:
        """
        Embed a list of texts sequentially (rate limiter applied per call).
        Returns a list of 768-dimensional vectors in the same order as `texts`.
        """
        embeddings: list[list[float]] = []
        for text in texts:
            embedding = await self.embed(text, task_type)
            embeddings.append(embedding)
        return embeddings


# Module-level singleton
gemini_client = GeminiClient()
