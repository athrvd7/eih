import asyncio
import logging

import tree_sitter_javascript as tsjavascript
import tree_sitter_python as tspython
import tree_sitter_typescript as tstypescript
from tree_sitter import Language, Parser

from app.agents.base import BaseAgent
from app.models.chunk import Chunk, ChunkList, ChunkType
from app.models.manifest import FileEntry, FileManifest

logger = logging.getLogger(__name__)


class Chunker(BaseAgent):
    """
    CHUNKER agent.

    Splits each file in a FileManifest into semantically meaningful Chunks:
      - Python/JS/TS/TSX  : tree-sitter AST extraction (functions + classes)
      - Markdown           : section-based splitting on headings
      - Everything else    : sliding-window fallback (2 000-char window, 200-char overlap)
    """

    def __init__(self, job_id: str):
        super().__init__(job_id)
        # Parsers and Language objects are initialised on first use per language
        self._parsers: dict[str, Parser] = {}
        self._languages: dict[str, Language] = {}

    # ------------------------------------------------------------------
    # Parser initialisation
    # ------------------------------------------------------------------

    def _get_parser(self, language: str) -> tuple[Parser | None, Language | None]:
        if language not in self._parsers:
            try:
                if language == "python":
                    lang = Language(tspython.language())
                elif language == "javascript":
                    lang = Language(tsjavascript.language())
                elif language == "typescript":
                    lang = Language(tstypescript.language_typescript())
                elif language == "tsx":
                    lang = Language(tstypescript.language_tsx())
                else:
                    return None, None
                self._parsers[language] = Parser(lang)
                self._languages[language] = lang
            except Exception as exc:
                logger.warning("Could not initialise parser for %s: %s", language, exc)
                return None, None
        return self._parsers.get(language), self._languages.get(language)

    # ------------------------------------------------------------------
    # BaseAgent.execute
    # ------------------------------------------------------------------

    async def execute(self, manifest: FileManifest) -> ChunkList:
        chunks: list[Chunk] = []
        total = len(manifest.files)

        for i, file_entry in enumerate(manifest.files):
            if i % 10 == 0:
                await self.report_progress(i / max(total, 1), f"Chunking {file_entry.path}")

            try:
                file_chunks = await asyncio.to_thread(self._chunk_file, file_entry)
                chunks.extend(file_chunks)
            except Exception as exc:
                logger.warning("Failed to chunk %s: %s", file_entry.path, exc)
                chunks.append(self._module_chunk(file_entry))

        return ChunkList(
            repo_id=manifest.repo_id,
            total_chunks=len(chunks),
            chunks=chunks,
        )

    # ------------------------------------------------------------------
    # Dispatch
    # ------------------------------------------------------------------

    def _chunk_file(self, file_entry: FileEntry) -> list[Chunk]:
        language = file_entry.language

        if language == "markdown":
            return self._chunk_markdown(file_entry)

        lang_map = {
            "python": "python",
            "javascript": "javascript",
            "typescript": "typescript",
            "tsx": "tsx",
        }
        parser_key = lang_map.get(language)

        if parser_key:
            parser, lang_obj = self._get_parser(parser_key)
            if parser and lang_obj:
                chunks = self._chunk_with_treesitter(file_entry, parser, lang_obj, parser_key)
                if chunks:
                    return chunks

        return self._chunk_sliding_window(file_entry)

    # ------------------------------------------------------------------
    # tree-sitter chunking
    # ------------------------------------------------------------------

    def _chunk_with_treesitter(
        self,
        file_entry: FileEntry,
        parser: Parser,
        lang_obj: Language,
        lang_key: str,
    ) -> list[Chunk]:
        code = file_entry.content
        lines = code.split("\n")
        tree = parser.parse(bytes(code, "utf-8"))
        chunks: list[Chunk] = []

        if lang_key == "python":
            chunks.extend(
                self._extract_python_nodes(file_entry, lang_obj, tree, lines)
            )

        elif lang_key in ("javascript", "typescript", "tsx"):
            chunks.extend(
                self._extract_js_nodes(file_entry, lang_obj, tree, lines)
            )

        if not chunks:
            return [self._module_chunk(file_entry)]
        return chunks

    def _extract_python_nodes(self, file_entry, lang_obj, tree, lines) -> list[Chunk]:
        chunks: list[Chunk] = []
        imports = self._extract_python_imports(file_entry.content)

        queries = [
            (
                "(function_definition name: (identifier) @name) @func",
                "func",
                ChunkType.FUNCTION,
            ),
            (
                "(class_definition name: (identifier) @name) @class",
                "class",
                ChunkType.CLASS,
            ),
        ]

        for query_str, node_key, chunk_type in queries:
            try:
                q = lang_obj.query(query_str)
                for _, capture_dict in q.matches(tree.root_node):
                    node_list = capture_dict.get(node_key, [])
                    name_list = capture_dict.get("name", [])
                    if not node_list or not name_list:
                        continue
                    node = node_list[0]
                    name = name_list[0].text.decode("utf-8")
                    start_line = node.start_point[0] + 1
                    end_line = node.end_point[0] + 1
                    snippet = "\n".join(lines[start_line - 1 : end_line])
                    chunks.append(
                        Chunk(
                            id=f"{file_entry.path}::{chunk_type.value}::{name}::{start_line}",
                            file_path=file_entry.path,
                            chunk_type=chunk_type,
                            name=name,
                            start_line=start_line,
                            end_line=end_line,
                            content=snippet,
                            language=file_entry.language,
                            imports=imports,
                        )
                    )
            except Exception as exc:
                logger.debug("Python query (%s) failed for %s: %s", query_str, file_entry.path, exc)

        return chunks

    def _extract_js_nodes(self, file_entry, lang_obj, tree, lines) -> list[Chunk]:
        chunks: list[Chunk] = []
        imports = self._extract_js_imports(file_entry.content)

        queries = [
            (
                "(function_declaration name: (identifier) @name) @func",
                "func",
                ChunkType.FUNCTION,
            ),
            (
                "(class_declaration name: (identifier) @name) @class",
                "class",
                ChunkType.CLASS,
            ),
        ]

        for query_str, node_key, chunk_type in queries:
            try:
                q = lang_obj.query(query_str)
                for _, capture_dict in q.matches(tree.root_node):
                    node_list = capture_dict.get(node_key, [])
                    name_list = capture_dict.get("name", [])
                    if not node_list or not name_list:
                        continue
                    node = node_list[0]
                    name = name_list[0].text.decode("utf-8")
                    start_line = node.start_point[0] + 1
                    end_line = node.end_point[0] + 1
                    snippet = "\n".join(lines[start_line - 1 : end_line])
                    chunks.append(
                        Chunk(
                            id=f"{file_entry.path}::{chunk_type.value}::{name}::{start_line}",
                            file_path=file_entry.path,
                            chunk_type=chunk_type,
                            name=name,
                            start_line=start_line,
                            end_line=end_line,
                            content=snippet,
                            language=file_entry.language,
                            imports=imports,
                        )
                    )
            except Exception as exc:
                logger.debug("JS/TS query (%s) failed for %s: %s", query_str, file_entry.path, exc)

        return chunks

    # ------------------------------------------------------------------
    # Markdown chunking
    # ------------------------------------------------------------------

    def _chunk_markdown(self, file_entry: FileEntry) -> list[Chunk]:
        chunks: list[Chunk] = []
        lines = file_entry.content.split("\n")
        current_lines: list[str] = []
        current_heading = "Overview"
        section_start = 1

        for i, line in enumerate(lines, start=1):
            if line.startswith("#"):
                # Flush the previous section
                if current_lines:
                    content = "\n".join(current_lines).strip()
                    if content:
                        chunks.append(
                            Chunk(
                                id=f"{file_entry.path}::doc_section::{current_heading}::{section_start}",
                                file_path=file_entry.path,
                                chunk_type=ChunkType.DOC_SECTION,
                                name=current_heading,
                                start_line=section_start,
                                end_line=i - 1,
                                content=content,
                                language="markdown",
                                imports=[],
                            )
                        )
                current_heading = line.lstrip("#").strip()[:100]
                section_start = i
                current_lines = [line]
            else:
                current_lines.append(line)

        # Flush the final section
        if current_lines:
            content = "\n".join(current_lines).strip()
            if content:
                chunks.append(
                    Chunk(
                        id=f"{file_entry.path}::doc_section::{current_heading}::{section_start}",
                        file_path=file_entry.path,
                        chunk_type=ChunkType.DOC_SECTION,
                        name=current_heading,
                        start_line=section_start,
                        end_line=len(lines),
                        content=content,
                        language="markdown",
                        imports=[],
                    )
                )

        return chunks if chunks else [self._module_chunk(file_entry)]

    # ------------------------------------------------------------------
    # Sliding-window fallback
    # ------------------------------------------------------------------

    def _chunk_sliding_window(
        self,
        file_entry: FileEntry,
        window_chars: int = 2000,
        overlap_chars: int = 200,
    ) -> list[Chunk]:
        content = file_entry.content
        if len(content) <= window_chars:
            return [self._module_chunk(file_entry)]

        chunks: list[Chunk] = []
        pos = 0
        idx = 0

        while pos < len(content):
            window = content[pos : pos + window_chars]
            start_line = content[:pos].count("\n") + 1
            end_line = start_line + window.count("\n")

            chunks.append(
                Chunk(
                    id=f"{file_entry.path}::module::chunk_{idx}::{start_line}",
                    file_path=file_entry.path,
                    chunk_type=ChunkType.MODULE,
                    name=f"chunk_{idx}",
                    start_line=start_line,
                    end_line=end_line,
                    content=window,
                    language=file_entry.language,
                    imports=[],
                )
            )
            pos += window_chars - overlap_chars
            idx += 1

        return chunks

    # ------------------------------------------------------------------
    # Module-level fallback chunk
    # ------------------------------------------------------------------

    def _module_chunk(self, file_entry: FileEntry) -> Chunk:
        lines = file_entry.content.split("\n")
        imports = (
            self._extract_python_imports(file_entry.content)
            if file_entry.language == "python"
            else self._extract_js_imports(file_entry.content)
        )
        return Chunk(
            id=f"{file_entry.path}::module::module::1",
            file_path=file_entry.path,
            chunk_type=ChunkType.MODULE,
            name="module",
            start_line=1,
            end_line=len(lines),
            content=file_entry.content[:3000],  # cap for large files
            language=file_entry.language,
            imports=imports,
        )

    # ------------------------------------------------------------------
    # Import extraction helpers
    # ------------------------------------------------------------------

    def _extract_python_imports(self, code: str) -> list[str]:
        imports = []
        for line in code.split("\n"):
            stripped = line.strip()
            if stripped.startswith("import ") or stripped.startswith("from "):
                imports.append(stripped)
        return imports[:20]

    def _extract_js_imports(self, code: str) -> list[str]:
        imports = []
        for line in code.split("\n"):
            stripped = line.strip()
            if stripped.startswith("import ") or "require(" in stripped:
                imports.append(stripped)
        return imports[:20]
