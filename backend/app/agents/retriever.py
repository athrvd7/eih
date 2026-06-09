import asyncio
import logging
import re
import json
from datetime import datetime

from app.agents.base import BaseAgent
from app.models.chat import ChatMessage, ChatResponse, Citation
from app.services.gemini_client import gemini_client
from app.services.vector_store import vector_store
from app.services import database

logger = logging.getLogger(__name__)

RETRIEVER_SYSTEM_PROMPT = """You are a codebase expert for "{repo_name}". Answer questions based ONLY on the provided context.
If the context doesn't contain the answer, say so honestly.

Rules:
1. Always cite your sources using [file_path:start_line-end_line] format inline in your answer.
2. Be specific — reference actual function names, class names, and file paths.
3. Keep answers concise but thorough (3-5 paragraphs max).
4. Format code with backticks: `function_name()`.
5. If multiple files are relevant, explain how they relate.

Retrieved Context:
{context}

After your answer, on a new line write exactly "FOLLOWUPS:" followed by 2-3 follow-up questions, one per line."""


class Retriever(BaseAgent):
    async def execute(
        self,
        job_id: str,
        question: str,
        collection_name: str,
        repo_name: str,
    ) -> ChatResponse:
        """RAG pipeline: embed query -> retrieve -> generate -> return with citations."""

        # Step 1: Embed the query
        await self.report_progress(0.1, "Searching codebase...")
        query_embedding = await gemini_client.embed(question, task_type="RETRIEVAL_QUERY")

        # Step 2: Query ChromaDB
        results = vector_store.query(
            collection_name=collection_name,
            query_embedding=query_embedding,
            n_results=5,
        )

        # Step 3: Build context from retrieved chunks
        context_parts = []
        citations = []

        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]

        for doc, meta in zip(docs, metas):
            file_path = meta.get("file_path", "unknown")
            start_line = int(meta.get("start_line", 0))
            end_line = int(meta.get("end_line", 0))
            name = meta.get("name", "")
            chunk_type = meta.get("chunk_type", "")

            context_parts.append(
                f"[{file_path}:{start_line}-{end_line}] ({chunk_type}: {name})\n"
                f"```\n{doc[:800]}\n```"
            )
            citations.append(Citation(
                file_path=file_path,
                start_line=start_line,
                end_line=end_line,
                snippet=doc[:200],
                chunk_name=name,
            ))

        context_str = "\n\n".join(context_parts)

        # Step 4: Fetch chat history for conversational context
        history = await database.get_chat_history(job_id, limit=10)
        history_str = "\n".join([
            f"{msg['role'].upper()}: {msg['content'][:200]}"
            for msg in reversed(history)  # Oldest first
        ])

        # Step 5: Call Gemini
        await self.report_progress(0.6, "Generating answer...")
        system_prompt = RETRIEVER_SYSTEM_PROMPT.format(
            repo_name=repo_name,
            context=context_str,
        )
        full_prompt = (
            f"Conversation history:\n{history_str}\n\nQuestion: {question}"
            if history_str
            else f"Question: {question}"
        )

        response_text = await gemini_client.generate(full_prompt, system_prompt=system_prompt)

        # Step 6: Parse answer and follow-up suggestions
        answer = response_text
        followups: list[str] = []

        if "FOLLOWUPS:" in response_text:
            parts = response_text.split("FOLLOWUPS:", 1)
            answer = parts[0].strip()
            followup_lines = parts[1].strip().split('\n')
            followups = [
                re.sub(r'^[\d\.\-\*\s]+', '', line).strip()
                for line in followup_lines
                if line.strip()
            ][:3]

        # Step 7: Persist messages to chat history
        await database.save_chat_message(job_id, "user", question)
        await database.save_chat_message(
            job_id,
            "assistant",
            answer,
            json.dumps([c.model_dump() for c in citations]),
        )

        return ChatResponse(
            answer=answer,
            citations=citations,
            suggested_followups=followups,
        )
