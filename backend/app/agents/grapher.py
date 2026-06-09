"""
GRAPHER agent — stub placeholder.

Analyses file imports/exports to build a DependencyGraph.
Full implementation to be added in a subsequent task.
"""
import logging
import re

from app.agents.base import BaseAgent
from app.models.graph import DependencyGraph, EdgeRelation, GraphEdge, GraphNode, NodeType
from app.models.manifest import FileManifest

logger = logging.getLogger(__name__)

# Simple heuristics to classify a file's role
_ENTRY_PATTERNS = re.compile(
    r"(main|index|app|server|wsgi|asgi|manage)\.(py|js|ts|tsx)$", re.IGNORECASE
)
_TEST_PATTERNS = re.compile(r"(test_|_test|\.test\.|\.spec\.)", re.IGNORECASE)
_CONFIG_EXTENSIONS = {".json", ".yaml", ".yml", ".toml", ".env"}


def _classify_node(path: str, language: str) -> NodeType:
    if _TEST_PATTERNS.search(path):
        return NodeType.TEST
    if _ENTRY_PATTERNS.search(path):
        return NodeType.ENTRY_POINT
    if language in ("yaml", "json", "toml", "text") or path.endswith(
        tuple(_CONFIG_EXTENSIONS)
    ):
        return NodeType.CONFIG
    if "util" in path.lower() or "helper" in path.lower() or "lib" in path.lower():
        return NodeType.UTILITY
    if "service" in path.lower() or "client" in path.lower():
        return NodeType.SERVICE
    return NodeType.COMPONENT


class Grapher(BaseAgent):
    """
    Builds a lightweight DependencyGraph from the file manifest.

    Currently performs a heuristic import-pattern analysis rather than
    a full AST-based resolution — sufficient for visualisation and navigation.
    """

    async def execute(self, manifest: FileManifest) -> DependencyGraph:
        await self.report_progress(0.1, "Building dependency graph...")

        nodes: list[GraphNode] = []
        edges: list[GraphEdge] = []
        entry_points: list[str] = []

        file_map = {f.path: f for f in manifest.files}

        for file_entry in manifest.files:
            node_type = _classify_node(file_entry.path, file_entry.language)
            node = GraphNode(
                id=file_entry.path,
                label=file_entry.path.split("/")[-1],
                type=node_type,
                language=file_entry.language,
                lines_of_code=file_entry.content.count("\n") + 1,
            )
            nodes.append(node)
            if node_type == NodeType.ENTRY_POINT:
                entry_points.append(file_entry.path)

        await self.report_progress(0.5, "Resolving import edges...")

        edge_id = 0
        for file_entry in manifest.files:
            imported = self._extract_local_imports(
                file_entry.content, file_entry.language, file_entry.path
            )
            for target_path, symbols in imported:
                if target_path in file_map:
                    edges.append(
                        GraphEdge(
                            id=f"e{edge_id}",
                            source=file_entry.path,
                            target=target_path,
                            relation=EdgeRelation.IMPORTS,
                            imported_symbols=symbols,
                        )
                    )
                    edge_id += 1

        await self.report_progress(0.9, "Graph complete.")

        return DependencyGraph(
            repo_id=manifest.repo_id,
            repo_name=manifest.repo_name,
            nodes=nodes,
            edges=edges,
            entry_points=entry_points,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _extract_local_imports(
        self, content: str, language: str, current_path: str
    ) -> list[tuple[str, list[str]]]:
        """
        Return a list of (resolved_path, [symbols]) for local imports found
        in *content*.  Only relative or project-relative imports are considered.
        """
        results: list[tuple[str, list[str]]] = []
        current_dir = "/".join(current_path.split("/")[:-1])

        if language == "python":
            # Match: from .module import X, Y  |  from app.foo import bar
            for m in re.finditer(
                r"^from\s+([\w\.]+)\s+import\s+(.+)$", content, re.MULTILINE
            ):
                module, symbols_str = m.group(1), m.group(2)
                symbols = [s.strip().split(" as ")[0] for s in symbols_str.split(",")]
                path = self._python_module_to_path(module, current_dir)
                if path:
                    results.append((path, symbols))

        elif language in ("javascript", "typescript", "tsx"):
            # Match: import { X } from './foo'  |  require('./bar')
            for m in re.finditer(
                r"""(?:import\s+(?:\{[^}]*\}|[\w*]+)\s+from\s+|require\s*\(\s*)['"](\.[^'"]+)['"]""",
                content,
            ):
                raw = m.group(1)
                symbols: list[str] = []
                # Try to extract named imports
                full = m.group(0)
                names_m = re.search(r"\{([^}]+)\}", full)
                if names_m:
                    symbols = [
                        s.strip().split(" as ")[0]
                        for s in names_m.group(1).split(",")
                    ]
                path = self._resolve_js_path(raw, current_dir)
                if path:
                    results.append((path, symbols))

        return results

    def _python_module_to_path(self, module: str, current_dir: str) -> str | None:
        if not module.startswith("."):
            # Absolute — try to match against repo root
            parts = module.replace(".", "/")
            for ext in (".py",):
                candidate = f"{parts}{ext}"
                return candidate
        # Relative
        dots = len(module) - len(module.lstrip("."))
        rel = module.lstrip(".")
        base = current_dir
        for _ in range(dots - 1):
            base = "/".join(base.split("/")[:-1])
        if rel:
            return f"{base}/{rel.replace('.', '/')}.py" if base else f"{rel.replace('.', '/')}.py"
        return None

    def _resolve_js_path(self, raw: str, current_dir: str) -> str | None:
        if not raw.startswith("."):
            return None
        parts = raw.split("/")
        base_parts = current_dir.split("/") if current_dir else []
        for part in parts:
            if part == "..":
                if base_parts:
                    base_parts.pop()
            elif part != ".":
                base_parts.append(part)
        path = "/".join(base_parts)
        # Guess the most likely extension
        for ext in (".ts", ".tsx", ".js", ".jsx"):
            candidate = f"{path}{ext}"
            return candidate  # return first guess; edge validity checked by caller
        return path
