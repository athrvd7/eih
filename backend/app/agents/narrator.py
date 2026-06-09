import asyncio
import logging
import json
from datetime import datetime

from app.agents.base import BaseAgent
from app.models.graph import DependencyGraph, GraphNode
from app.models.chunk import ChunkList
from app.models.walkthrough import Walkthrough, WalkthroughStep
from app.services.gemini_client import gemini_client

logger = logging.getLogger(__name__)

NARRATOR_PROMPT = """You are an expert code explainer generating a walkthrough for the "{repo_name}" codebase.

## File: {file_path}
## Node Type: {node_type}
## This file imports: {imports}
## This file is imported by: {imported_by}

## Code (first 3000 chars):
```
{code_content}
```

## Instructions:
Generate a walkthrough step for a developer seeing this codebase for the first time.
Respond ONLY with valid JSON (no markdown, no code blocks):
{{
  "title": "Step {step_num}: <short descriptive title>",
  "explanation": "<2-4 paragraph explanation of what this file does, its role, and how it connects to the rest>",
  "key_snippet_start_line": <line number>,
  "key_snippet_end_line": <line number>,
  "concepts": ["concept1", "concept2", "concept3"]
}}"""


class Narrator(BaseAgent):
    async def execute(self, graph: DependencyGraph, chunks: ChunkList) -> Walkthrough:
        # Build file content map from chunks
        file_content: dict[str, str] = {}
        for chunk in chunks.chunks:
            if chunk.file_path not in file_content:
                file_content[chunk.file_path] = chunk.content
            else:
                file_content[chunk.file_path] += "\n" + chunk.content

        # Select files for walkthrough (up to 12 files based on importance)
        selected_files = self._select_files(graph)

        # Build import / imported_by maps
        imports_map: dict[str, list[str]] = {n.id: [] for n in graph.nodes}
        imported_by_map: dict[str, list[str]] = {n.id: [] for n in graph.nodes}
        for edge in graph.edges:
            imports_map[edge.source].append(edge.target)
            imported_by_map[edge.target].append(edge.source)

        # Generate steps
        steps = []
        total = len(selected_files)

        for i, node in enumerate(selected_files):
            await self.report_progress(i / total, f"Generating walkthrough for {node.label}...")

            code = file_content.get(node.id, "")[:3000]
            imports = imports_map.get(node.id, [])[:5]
            imported_by = imported_by_map.get(node.id, [])[:5]

            try:
                step = await self._generate_step(
                    node=node,
                    repo_name=graph.repo_name,
                    code_content=code,
                    imports=imports,
                    imported_by=imported_by,
                    step_num=i + 1,
                )
                steps.append(step)

                # Rate limit: 4-second delay between Gemini calls
                if i < total - 1:
                    await asyncio.sleep(4)

            except Exception as e:
                logger.error(f"Failed to generate step for {node.id}: {e}")
                # Fallback step without AI
                steps.append(WalkthroughStep(
                    order=i + 1,
                    title=f"Step {i + 1}: {node.label}",
                    file_path=node.id,
                    explanation=(
                        f"This file ({node.label}) is a {node.type.value} "
                        f"in the {graph.repo_name} codebase."
                    ),
                    code_snippet=code[:500],
                    snippet_start_line=1,
                    snippet_end_line=min(20, code.count('\n') + 1),
                    related_files=imports[:3],
                    graph_node_ids=[node.id],
                    concepts=[node.type.value],
                ))

        return Walkthrough(
            repo_id=graph.repo_id,
            repo_name=graph.repo_name,
            total_steps=len(steps),
            steps=steps,
            generated_at=datetime.utcnow().isoformat(),
        )

    # ------------------------------------------------------------------
    # File selection
    # ------------------------------------------------------------------

    def _select_files(self, graph: DependencyGraph, max_files: int = 12) -> list[GraphNode]:
        """Select the most important files for the walkthrough."""
        import_count: dict[str, int] = {n.id: 0 for n in graph.nodes}
        imported_by_count: dict[str, int] = {n.id: 0 for n in graph.nodes}
        for edge in graph.edges:
            import_count[edge.source] = import_count.get(edge.source, 0) + 1
            imported_by_count[edge.target] = imported_by_count.get(edge.target, 0) + 1

        def score(node: GraphNode) -> int:
            if node.type.value in ('test', 'config'):
                return 0
            base = imported_by_count.get(node.id, 0) * 2 + import_count.get(node.id, 0)
            if node.id in graph.entry_points:
                base += 100
            if node.type.value == 'service':
                base += 10
            if node.type.value == 'component':
                base += 5
            return base

        sorted_nodes = sorted(graph.nodes, key=score, reverse=True)

        entry_nodes = [n for n in sorted_nodes if n.id in graph.entry_points]
        other_nodes = [n for n in sorted_nodes if n.id not in graph.entry_points]

        selected = entry_nodes[:3] + other_nodes[:max_files - len(entry_nodes[:3])]
        return selected[:max_files]

    # ------------------------------------------------------------------
    # Step generation
    # ------------------------------------------------------------------

    async def _generate_step(
        self,
        node: GraphNode,
        repo_name: str,
        code_content: str,
        imports: list[str],
        imported_by: list[str],
        step_num: int,
    ) -> WalkthroughStep:
        prompt = NARRATOR_PROMPT.format(
            repo_name=repo_name,
            file_path=node.id,
            node_type=node.type.value,
            imports=', '.join(imports) if imports else 'none',
            imported_by=', '.join(imported_by) if imported_by else 'none',
            code_content=code_content,
            step_num=step_num,
        )

        response_text = await gemini_client.generate(prompt)

        # Parse JSON response — strip markdown code fences if present
        try:
            clean = response_text.strip()
            if clean.startswith("```"):
                clean = clean.split("```")[1]
                if clean.startswith("json"):
                    clean = clean[4:]
            if clean.startswith("```"):
                clean = clean[3:]
            data = json.loads(clean.strip())
        except Exception as e:
            logger.warning(
                f"Failed to parse Gemini response as JSON: {e}. "
                f"Response: {response_text[:200]}"
            )
            data = {
                "title": f"Step {step_num}: {node.label}",
                "explanation": response_text[:500],
                "key_snippet_start_line": 1,
                "key_snippet_end_line": 20,
                "concepts": [node.type.value],
            }

        start_line = int(data.get("key_snippet_start_line", 1))
        end_line = int(data.get("key_snippet_end_line", start_line + 20))
        lines = code_content.split('\n')
        snippet = '\n'.join(lines[max(0, start_line - 1):min(end_line, len(lines))])

        return WalkthroughStep(
            order=step_num,
            title=data.get("title", f"Step {step_num}: {node.label}"),
            file_path=node.id,
            explanation=data.get("explanation", ""),
            code_snippet=snippet,
            snippet_start_line=start_line,
            snippet_end_line=end_line,
            related_files=imports[:5],
            graph_node_ids=[node.id],
            concepts=data.get("concepts", [])[:5],
        )
