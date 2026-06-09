import asyncio
import logging
from datetime import datetime

from app.agents.base import BaseAgent
from app.models.graph import DependencyGraph
from app.models.chunk import ChunkList
from app.models.onboarding import OnboardingDoc, DocSection
from app.services.gemini_client import gemini_client

logger = logging.getLogger(__name__)

SCRIBE_SYSTEM_PROMPT = """You are a senior engineer writing clear, specific onboarding documentation.
Write only about THIS codebase — no generic advice. Use specific file paths and function names.
Format as clean Markdown with code references in backticks."""

SECTION_PROMPTS = {
    "Project Purpose": """Generate the "Project Purpose" section for {repo_name}.

## Available Context:
{context}

Write 2-3 paragraphs explaining what this project does, its main value proposition, and who uses it.
Be specific to THIS codebase. Do NOT write generic content.""",

    "Tech Stack": """Generate the "Tech Stack" section for {repo_name}.

## Available Context:
{context}

## Key files found:
{key_files}

List the technologies, frameworks, and libraries used. Organize by category (Frontend/Backend/Database/etc).
Include version info if available. Reference specific config files.""",

    "Architecture Overview": """Generate the "Architecture Overview" section for {repo_name}.

## Graph Statistics:
- Total files: {total_nodes}
- Languages: {languages}
- Entry points: {entry_points}
- File types by role: {type_counts}

## Key relationships:
{relationships}

Describe the high-level architecture. Explain how the main components relate to each other.
Include a simple text diagram if helpful.""",

    "Key Files & Entry Points": """Generate the "Key Files & Entry Points" section for {repo_name}.

## Entry point files:
{entry_point_details}

## High-connectivity files:
{hub_files}

List and explain the most important files. For each: what it does, why it matters, where to start reading.""",

    "Data Flow Summary": """Generate the "Data Flow Summary" section for {repo_name}.

## Import/dependency relationships:
{dependency_summary}

## Service layer files:
{service_files}

Trace how data flows through the application from input to output.
Explain the main request/response cycle or data processing pipeline.""",

    "Local Setup Guide": """Generate the "Local Setup Guide" section for {repo_name}.

## Available setup files found:
{setup_files_content}

Write a step-by-step local development setup guide. Include:
1. Prerequisites
2. Installation
3. Configuration (env vars)
4. Running the project
5. Running tests (if applicable)

Be specific — use actual commands and file names from this repo.""",
}


class Scribe(BaseAgent):
    async def execute(
        self,
        graph: DependencyGraph,
        chunks: ChunkList,
        readme: str | None = None,
    ) -> OnboardingDoc:
        sections = []
        section_titles = list(SECTION_PROMPTS.keys())
        total = len(section_titles)

        # Pre-compute shared context once
        context = self._build_context(graph, chunks, readme)

        for i, section_title in enumerate(section_titles):
            await self.report_progress(i / total, f"Generating: {section_title}...")

            try:
                section = await self._generate_section(section_title, graph, chunks, context)
                sections.append(section)

                # Rate limit: 4 seconds between Gemini calls
                if i < total - 1:
                    await asyncio.sleep(4)
            except Exception as e:
                logger.error(f"Failed to generate section '{section_title}': {e}")
                sections.append(DocSection(
                    title=section_title,
                    content=f"*Section generation failed: {str(e)}*",
                    sources=[],
                ))

        return OnboardingDoc(
            repo_id=graph.repo_id,
            repo_name=graph.repo_name,
            sections=sections,
            generated_at=datetime.utcnow().isoformat(),
        )

    # ------------------------------------------------------------------
    # Context builder
    # ------------------------------------------------------------------

    def _build_context(
        self,
        graph: DependencyGraph,
        chunks: ChunkList,
        readme: str | None,
    ) -> dict:
        """Pre-compute shared context for all section prompts."""
        lang_counts: dict[str, int] = {}
        for node in graph.nodes:
            lang_counts[node.language] = lang_counts.get(node.language, 0) + 1

        type_counts: dict[str, int] = {}
        for node in graph.nodes:
            type_counts[node.type.value] = type_counts.get(node.type.value, 0) + 1

        entry_nodes = [n for n in graph.nodes if n.id in graph.entry_points]

        # Hub files — most imported
        imported_by_count: dict[str, int] = {}
        for edge in graph.edges:
            imported_by_count[edge.target] = imported_by_count.get(edge.target, 0) + 1

        hub_file_ids = sorted(
            imported_by_count, key=imported_by_count.get, reverse=True  # type: ignore[arg-type]
        )[:5]

        # First 500 chars of each file from chunks
        file_content: dict[str, str] = {}
        for chunk in chunks.chunks:
            if chunk.file_path not in file_content:
                file_content[chunk.file_path] = chunk.content[:500]

        return {
            "readme": readme or "",
            "lang_counts": lang_counts,
            "type_counts": type_counts,
            "entry_nodes": entry_nodes,
            "hub_file_ids": hub_file_ids,
            "imported_by": imported_by_count,
            "file_content": file_content,
        }

    # ------------------------------------------------------------------
    # Section generation
    # ------------------------------------------------------------------

    async def _generate_section(
        self,
        section_title: str,
        graph: DependencyGraph,
        chunks: ChunkList,
        context: dict,
    ) -> DocSection:
        template = SECTION_PROMPTS[section_title]

        if section_title == "Project Purpose":
            readme_excerpt = context["readme"][:2000] if context["readme"] else "No README available."
            entry_code = "\n\n".join([
                f"File: {n.id}\n{context['file_content'].get(n.id, '')}"
                for n in context["entry_nodes"][:2]
            ])
            prompt = template.format(
                repo_name=graph.repo_name,
                context=f"README:\n{readme_excerpt}\n\nEntry point code:\n{entry_code}",
            )

        elif section_title == "Tech Stack":
            config_files = [n for n in graph.nodes if n.type.value == "config"]
            config_content = "\n\n".join([
                f"{n.id}:\n{context['file_content'].get(n.id, '')}"
                for n in config_files[:5]
            ])
            prompt = template.format(
                repo_name=graph.repo_name,
                context=(
                    f"Languages: {context['lang_counts']}\n"
                    f"Config content:\n{config_content}"
                ),
                key_files="\n".join([n.id for n in graph.nodes[:20]]),
            )

        elif section_title == "Architecture Overview":
            relationships = "\n".join([
                f"{e.source} -> {e.target}" for e in graph.edges[:20]
            ])
            prompt = template.format(
                repo_name=graph.repo_name,
                total_nodes=len(graph.nodes),
                languages=str(context["lang_counts"]),
                entry_points=", ".join(graph.entry_points[:5]),
                type_counts=str(context["type_counts"]),
                relationships=relationships,
            )

        elif section_title == "Key Files & Entry Points":
            entry_details = "\n\n".join([
                (
                    f"**{n.id}** ({n.type.value}, {n.lines_of_code} lines):\n"
                    f"{context['file_content'].get(n.id, '')[:300]}"
                )
                for n in context["entry_nodes"][:5]
            ])
            hub_nodes = [n for n in graph.nodes if n.id in context["hub_file_ids"]]
            hub_details = "\n".join([
                f"- {n.id} (imported by {context['imported_by'].get(n.id, 0)} files)"
                for n in hub_nodes[:5]
            ])
            prompt = template.format(
                repo_name=graph.repo_name,
                entry_point_details=entry_details,
                hub_files=hub_details,
            )

        elif section_title == "Data Flow Summary":
            service_nodes = [n for n in graph.nodes if n.type.value == "service"]
            service_content = "\n\n".join([
                f"{n.id}:\n{context['file_content'].get(n.id, '')[:300]}"
                for n in service_nodes[:5]
            ])
            dep_summary = "\n".join([
                (
                    f"{e.source} -> {e.target} "
                    f"({', '.join(e.imported_symbols[:3]) or 'full module'})"
                )
                for e in graph.edges[:15]
            ])
            prompt = template.format(
                repo_name=graph.repo_name,
                dependency_summary=dep_summary,
                service_files=service_content,
            )

        elif section_title == "Local Setup Guide":
            setup_keywords = [
                'makefile', 'dockerfile', 'docker-compose', 'setup.py',
                'pyproject', 'package.json', '.env.example', 'readme',
            ]
            setup_files = [
                n for n in graph.nodes
                if any(kw in n.id.lower() for kw in setup_keywords)
            ]
            setup_content = "\n\n".join([
                f"**{n.id}**:\n{context['file_content'].get(n.id, '')[:500]}"
                for n in setup_files[:5]
            ])
            readme_excerpt = context["readme"][:1500] if context["readme"] else ""
            prompt = template.format(
                repo_name=graph.repo_name,
                setup_files_content=f"README:\n{readme_excerpt}\n\nSetup files:\n{setup_content}",
            )

        else:
            prompt = template.format(repo_name=graph.repo_name, context="")

        response = await gemini_client.generate(prompt, system_prompt=SCRIBE_SYSTEM_PROMPT)

        return DocSection(
            title=section_title,
            content=response,
            sources=[n.id for n in context["entry_nodes"][:3]],
        )
