# Engineering Intelligence Hub — Agent Architecture

**Version:** 1.0  
**Date:** June 2026  
**Author:** Atharva Dahake  
**Derived from:** [prd.md](file:///Users/atharvadahake/Downloads/eih-project/prd.md) • [implementation-plan.md](file:///Users/atharvadahake/Downloads/eih-project/implementation-plan.md)

---

## Overview

EIH operates as a **multi-agent pipeline** where each agent owns a single responsibility. Agents are Python classes orchestrated by a `JobManager` that runs them sequentially as FastAPI background tasks, streaming progress via Server-Sent Events (SSE).

### Pipeline Diagram

```
User Input (GitHub URL / ZIP / Docs)
         │
         ▼
    ┌─────────┐
    │INGESTOR │ ── Clone / Extract / Filter
    └────┬────┘
         │ FileManifest
    ┌────▼────┐
    │ CHUNKER │ ── tree-sitter AST parsing
    └────┬────┘
         │ ChunkList
    ┌────▼────┐         ┌─────────┐
    │EMBEDDER │ ◄──────►│ ChromaDB│
    └────┬────┘         └─────────┘
         │                   
    ┌────▼────┐  (parallel with EMBEDDER using FileManifest)
    │ GRAPHER │ ── Import/Export parsing
    └────┬────┘
         │ DependencyGraph
         ├─────────────────────────┐
    ┌────▼────┐           ┌───────▼──┐
    │NARRATOR │           │  SCRIBE  │  ← Lazy (on-demand)
    └─────────┘           └──────────┘
         
    ┌─────────┐
    │RETRIEVER│ ← Per chat message (uses ChromaDB + Gemini)
    └─────────┘
```

---

## Agent Pipeline Execution Order

| Stage | Agent | Trigger | Blocking? | Gemini API? |
|-------|-------|---------|-----------|-------------|
| 1 | **INGESTOR** | User submits URL/ZIP/docs | Yes (must complete before others) | No |
| 2 | **CHUNKER** | INGESTOR output ready | Yes | No |
| 3a | **EMBEDDER** | CHUNKER output ready | Yes | Yes (Embedding API) |
| 3b | **GRAPHER** | INGESTOR output ready (runs parallel with EMBEDDER) | Yes | No |
| 4a | **NARRATOR** | GRAPHER + EMBEDDER done | On-demand (lazy) | Yes (LLM) |
| 4b | **SCRIBE** | GRAPHER + EMBEDDER done | On-demand (lazy) | Yes (LLM) |
| 5 | **RETRIEVER** | User sends chat message | Per-request | Yes (Embedding + LLM) |

> **IMPORTANT:** NARRATOR and SCRIBE are triggered lazily — they only run when the user opens the walkthrough or docs tab. This avoids burning Gemini rate limits during initial ingestion.

---

## Base Agent Class

All agents inherit from a common base that provides logging, error handling, and progress reporting.

```python
# backend/app/agents/base.py

from abc import ABC, abstractmethod
from typing import Any
from app.services.sse_manager import SSEManager

class BaseAgent(ABC):
    """Base class for all EIH pipeline agents."""
    
    def __init__(self, job_id: str, sse: SSEManager):
        self.job_id = job_id
        self.sse = sse
        self.agent_name = self.__class__.__name__
    
    async def run(self, **kwargs) -> Any:
        """Execute agent with progress tracking and error handling."""
        await self.sse.emit(self.job_id, stage=self.agent_name, status="started")
        try:
            result = await self.execute(**kwargs)
            await self.sse.emit(self.job_id, stage=self.agent_name, status="complete")
            return result
        except Exception as e:
            await self.sse.emit(
                self.job_id, stage=self.agent_name,
                status="failed", error=str(e)
            )
            raise
    
    @abstractmethod
    async def execute(self, **kwargs) -> Any:
        """Override in subclasses with actual agent logic."""
        ...
    
    async def report_progress(self, progress: float, message: str):
        """Emit progress update (0.0 → 1.0)."""
        await self.sse.emit(
            self.job_id, stage=self.agent_name,
            status="running", progress=progress, message=message
        )
```

---

## Agent 1: INGESTOR

### Responsibility
Clone GitHub repositories, extract ZIP uploads, walk the file tree, and filter to relevant source/doc files.

### Input → Output

| Input | Output |
|-------|--------|
| GitHub URL (`https://github.com/owner/repo`) | `FileManifest` |
| ZIP archive (max 100MB, configurable) | `FileManifest` |
| Documentation files (`.md`, `.txt`, `.rst`) | `FileManifest` |

### Output Model

```python
# backend/app/models/manifest.py

from pydantic import BaseModel

class FileEntry(BaseModel):
    path: str              # Relative path: "src/auth/login.py"
    language: str          # "python", "javascript", "typescript", "markdown"
    size_bytes: int
    content: str           # Raw file content
    sha256: str            # Content hash for caching

class FileManifest(BaseModel):
    repo_id: str           # Unique identifier (URL hash or ZIP hash)
    repo_name: str         # Display name: "facebook/react"
    total_files: int
    files: list[FileEntry]
    readme_content: str | None  # Extracted README.md if present
```

### Implementation Details

```python
# backend/app/agents/ingestor.py

class Ingestor(BaseAgent):
    """Clones repos, extracts ZIPs, produces file manifests."""
    
    ALLOWED_EXTENSIONS = {
        ".py", ".js", ".ts", ".tsx", ".jsx",     # Source code
        ".md", ".txt", ".rst",                    # Documentation
        ".json", ".yaml", ".yml", ".toml",        # Config
        ".css", ".scss", ".html",                 # Web assets
    }
    
    IGNORED_DIRS = {
        "node_modules", ".git", "dist", "build", "__pycache__",
        "venv", ".venv", "env", ".env", ".next", "vendor",
        "target", ".idea", ".vscode", "coverage",
    }
    
    MAX_FILE_SIZE = 1_000_000  # 1MB per file — skip larger files
```

### Key Implementation Notes
- **GitPython is blocking** — always use `asyncio.to_thread()` to avoid blocking the event loop
- Use `depth=1` for shallow clones (saves time and disk — EIH only needs latest state)
- Validate URL format before cloning
- Respect `.eihignore` if present in repo root
- Compute `repo_id` as hash of URL + latest commit SHA for caching

### Error Handling

| Error | Recovery |
|-------|----------|
| Invalid URL | Return 400 with clear message |
| Clone timeout (>120s) | Abort, return 408 |
| Repo too large (>500MB) | Warn user, offer directory filtering |
| ZIP extraction fails | Return 400, corrupt archive |
| No relevant files found | Return 422, "No source files detected" |

---

## Agent 2: CHUNKER

### Responsibility
Split source files into semantic chunks using tree-sitter AST parsing. Functions, classes, and methods become individual chunks. Markdown is split by headings.

### Input → Output

| Input | Output |
|-------|--------|
| `FileManifest` from INGESTOR | `ChunkList` |

### Output Model

```python
# backend/app/models/chunk.py

from pydantic import BaseModel
from enum import Enum

class ChunkType(str, Enum):
    FUNCTION = "function"
    CLASS = "class"
    METHOD = "method"
    MODULE = "module"        # Top-level code outside functions/classes
    DOC_SECTION = "doc_section"
    CONFIG = "config"

class Chunk(BaseModel):
    id: str                  # Deterministic: "{file_path}::{chunk_type}::{name}::{start_line}"
    file_path: str
    chunk_type: ChunkType
    name: str                # Function/class name or section heading
    start_line: int
    end_line: int
    content: str
    language: str
    parent_class: str | None # For methods: which class they belong to
    imports: list[str]       # Imports found in this file

class ChunkList(BaseModel):
    repo_id: str
    total_chunks: int
    chunks: list[Chunk]
```

### tree-sitter Setup

```python
# Use pre-compiled wheel packages (NOT the deprecated tree-sitter-languages)
import tree_sitter_python as tspython
import tree_sitter_javascript as tsjavascript
import tree_sitter_typescript as tstypescript
from tree_sitter import Language, Parser

PARSERS = {
    "python": Language(tspython.language()),
    "javascript": Language(tsjavascript.language()),
    "typescript": Language(tstypescript.language_typescript()),  # Note: .language_typescript()
    "tsx": Language(tstypescript.language_tsx()),                 # Separate for TSX
}
```

### tree-sitter Queries

```lisp
# Python — function/class extraction
(function_definition name: (identifier) @func_name) @function
(class_definition name: (identifier) @class_name) @class

# JavaScript/TypeScript — function/class/export extraction
(function_declaration name: (identifier) @func_name) @function
(class_declaration name: (identifier) @class_name) @class
(arrow_function) @arrow_func
(export_statement declaration: (_) @exported)
```

### Chunking Strategy

| Scenario | Strategy |
|----------|----------|
| Small function (<50 tokens) | Merge with adjacent functions into one chunk |
| Normal function (50-500 tokens) | One chunk per function |
| Large function (>500 tokens) | Keep whole — don't split mid-logic |
| Class with methods | Class docstring/body = 1 chunk + each method = 1 chunk |
| Module-level code | Collect all top-level statements not in functions/classes |
| Markdown | One chunk per heading section |
| Unsupported languages | Sliding window: 500 tokens, 50 token overlap |

### Key Implementation Notes
- Source code must be encoded as bytes: `parser.parse(bytes(source_code, "utf8"))`
- tree-sitter produces a CST (Concrete Syntax Tree), not AST — it preserves whitespace/comments
- Run parsing in threadpool from FastAPI (it's CPU-bound C code)
- Fallback to regex-based parsing for unsupported languages

---

## Agent 3: EMBEDDER

### Responsibility
Generate vector embeddings for all chunks using Gemini Embedding API and store them in ChromaDB.

### Input → Output

| Input | Output |
|-------|--------|
| `ChunkList` from CHUNKER | ChromaDB collection (side effect) + `collection_name: str` |

### Implementation Details

```python
# backend/app/agents/embedder.py

from google import genai
from google.genai import types

class Embedder(BaseAgent):
    """Batch-embeds chunks into ChromaDB with rate limiting."""
    
    BATCH_SIZE = 10          # Chunks per API call
    BATCH_DELAY = 4.0        # Seconds between batches (stay under 15 RPM)
    EMBEDDING_DIM = 768      # Reduced dimensionality for efficiency
    MAX_RETRIES = 3
```

### Gemini Embedding API Usage

```python
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

# For document chunks (during indexing)
response = client.models.embed_content(
    model="gemini-embedding-001",
    contents="code chunk text here",
    config=types.EmbedContentConfig(
        task_type="RETRIEVAL_DOCUMENT",
        output_dimensionality=768
    )
)
embedding = response.embeddings[0].values

# For user queries (during chat)
response = client.models.embed_content(
    model="gemini-embedding-001",
    contents="user question here",
    config=types.EmbedContentConfig(
        task_type="RETRIEVAL_QUERY",   # Different task type for queries!
        output_dimensionality=768
    )
)
```

### ChromaDB Collection Design

```python
# One collection per repository
collection = client.get_or_create_collection(
    name=f"code_{repo_id}",
    metadata={"hnsw:space": "cosine"}
)

# Adding chunks with metadata
collection.add(
    ids=["src/auth/login.py::function::authenticate_user::L15"],
    documents=["def authenticate_user(username, password): ..."],
    embeddings=[[0.1, 0.2, ...]],  # 768-dim vector
    metadatas=[{
        "file_path": "src/auth/login.py",
        "chunk_type": "function",
        "name": "authenticate_user",
        "language": "python",
        "start_line": 15,
        "end_line": 42,
        "parent_class": "",
    }],
)
```

### ChromaDB Metadata Schema

| Field | Type | Filterable? | Purpose |
|-------|------|-------------|---------|
| `file_path` | string | ✅ | Source location |
| `chunk_type` | string | ✅ | function/class/method/module/doc_section |
| `name` | string | ✅ | Symbol name |
| `language` | string | ✅ | Programming language |
| `start_line` | int | ❌ | For citations |
| `end_line` | int | ❌ | For citations |
| `parent_class` | string | ❌ | Method context |

### Rate Limiting Strategy

```
Batch 1 (10 chunks) ──── 4s gap ──── Batch 2 (10 chunks) ──── 4s gap ──── ...

On 429 error:
  Retry 1 after 2s
  Retry 2 after 4s
  Retry 3 after 8s
  Then fail with error

Use `tenacity` library for retry logic.
```

### Key Implementation Notes
- Use `output_dimensionality=768` (not the default 3072) — saves storage and ChromaDB memory
- `task_type` matters: `"RETRIEVAL_DOCUMENT"` for indexing, `"RETRIEVAL_QUERY"` for searching
- ChromaDB `hnsw:space` must be `"cosine"` to match Gemini embeddings
- In Docker, connect via `chromadb.HttpClient(host="chromadb", port=8000)`
- Set `ANONYMIZED_TELEMETRY=FALSE` in ChromaDB Docker env

---

## Agent 4: GRAPHER

### Responsibility
Parse import/export statements from source files using tree-sitter AST. Build a dependency graph as nodes (files) and edges (imports). Classify node types.

### Input → Output

| Input | Output |
|-------|--------|
| `FileManifest` from INGESTOR | `DependencyGraph` |

### Output Model

```python
# backend/app/models/graph.py

from pydantic import BaseModel
from enum import Enum

class NodeType(str, Enum):
    ENTRY_POINT = "entry_point"   # main.py, index.ts, app.py
    COMPONENT = "component"       # React components, UI modules
    SERVICE = "service"           # Business logic, API handlers
    UTILITY = "utility"           # Helpers, utils
    CONFIG = "config"             # Configuration files
    TEST = "test"                 # Test files

class EdgeRelation(str, Enum):
    IMPORTS = "imports"
    EXPORTS = "exports"
    CALLS = "calls"

class GraphNode(BaseModel):
    id: str                  # File path: "src/auth/login.py"
    label: str               # Display name: "login.py"
    type: NodeType
    language: str
    summary: str | None = None  # AI-generated (lazy, filled by Gemini later)
    lines_of_code: int

class GraphEdge(BaseModel):
    id: str                  # "e_{source_hash}_{target_hash}"
    source: str              # Source node ID
    target: str              # Target node ID
    relation: EdgeRelation
    imported_symbols: list[str]  # What was imported: ["authenticate", "User"]

class DependencyGraph(BaseModel):
    repo_id: str
    repo_name: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    entry_points: list[str]  # Node IDs of detected entry points
```

### tree-sitter Import Queries

```lisp
# Python imports
(import_statement name: (dotted_name) @import_path)
(import_from_statement
  module_name: (dotted_name) @module_path
  name: (import_from_as_list (dotted_name) @imported_name))

# JavaScript/TypeScript imports
(import_statement source: (string) @source_path)
(call_expression
  function: (identifier) @func_name
  arguments: (arguments (string) @source_path))  # require() calls
(export_declaration source: (string) @source_path)
```

### Import Resolution Strategy

| Language | Import Pattern | Resolution |
|----------|---------------|------------|
| Python | `from auth.login import func` | Map `auth.login` → `auth/login.py` |
| Python | `import auth.login` | Map `auth.login` → `auth/login.py` |
| JS/TS | `import { x } from './auth/login'` | Try: `.ts`, `.tsx`, `.js`, `/index.ts`, `/index.js` |
| JS/TS | `const x = require('./auth/login')` | Same resolution as import |

### Node Classification Heuristics

```python
def _classify_node(self, path: str, imports: list, imported_by: list) -> NodeType:
    filename = path.split("/")[-1]
    
    # Pattern-based classification
    if filename in ["main.py", "app.py", "index.ts", "index.js", "server.py"]:
        return NodeType.ENTRY_POINT
    if any(d in path for d in ["component", "components", "ui", "views", "pages"]):
        return NodeType.COMPONENT
    if any(d in path for d in ["service", "services", "api", "handlers", "routes"]):
        return NodeType.SERVICE
    if any(d in path for d in ["util", "utils", "helpers", "lib", "common"]):
        return NodeType.UTILITY
    if any(d in path for d in ["test", "tests", "__tests__", "spec"]):
        return NodeType.TEST
    if filename in ["config.py", "settings.py", "config.ts"]:
        return NodeType.CONFIG
    
    # Connectivity-based fallback
    if len(imported_by) > len(imports):
        return NodeType.UTILITY
    return NodeType.SERVICE
```

### Node Color Map (for React Flow UI)

| NodeType | Color | Hex |
|----------|-------|-----|
| ENTRY_POINT | Green | `#22c55e` |
| COMPONENT | Blue | `#3b82f6` |
| SERVICE | Orange | `#f97316` |
| UTILITY | Grey | `#94a3b8` |
| CONFIG | Purple | `#a855f7` |
| TEST | Yellow | `#eab308` |

---

## Agent 5: NARRATOR

### Responsibility
Generate a guided code walkthrough — an ordered sequence of steps that explain the codebase architecture starting from entry points and tracing key flows.

### Input → Output

| Input | Output |
|-------|--------|
| `DependencyGraph` from GRAPHER + `ChunkList` from CHUNKER | `Walkthrough` |

### Output Model

```python
# backend/app/models/walkthrough.py

from pydantic import BaseModel

class WalkthroughStep(BaseModel):
    order: int
    title: str               # "Entry Point — main.py"
    file_path: str
    explanation: str          # AI-generated explanation (2-4 paragraphs)
    code_snippet: str         # Key code from this file
    snippet_start_line: int
    snippet_end_line: int
    related_files: list[str]  # Connected files
    graph_node_ids: list[str] # Node IDs to highlight in the graph
    concepts: list[str]       # Key concepts: ["routing", "middleware", "auth"]

class Walkthrough(BaseModel):
    repo_id: str
    repo_name: str
    total_steps: int
    steps: list[WalkthroughStep]
    generated_at: str         # ISO timestamp
```

### File Selection Strategy

The NARRATOR selects 8-15 files for the walkthrough based on importance:
1. **Entry points** — always included (main.py, index.ts, app.py, etc.)
2. **High-connectivity nodes** — files with the most imports/dependents
3. **Core services** — business logic files
4. **Key components** — primary UI components

Files excluded: tests, configs, utilities with <3 connections.

### Ordering Strategy

```
Step 1: Entry Point (main.py / index.ts)
Step 2: Configuration & Setup
Step 3-4: Core Business Logic / Service Layer
Step 5-7: Feature Modules (auth, data, API)
Step 8-10: Components / Views
Step 11+: Supporting Utilities
```

### Gemini Prompt Template

```
You are an expert code explainer. Generate a walkthrough step for the following file
in a codebase called "{repo_name}".

## File: {file_path}
## Code:
{code_content}

## Context:
- This file is imported by: {imported_by}
- This file imports: {imports}
- Its role in the codebase: {node_type}

## Instructions:
1. Explain what this file does in 2-4 paragraphs for a developer seeing this repo for the first time.
2. Highlight the most important function or class.
3. Explain how it connects to other parts of the codebase.
4. List 2-3 key concepts a newcomer should understand.

Respond in JSON:
{
  "explanation": "...",
  "key_snippet_start_line": N,
  "key_snippet_end_line": M,
  "concepts": ["concept1", "concept2"]
}
```

### Key Implementation Notes
- **Runs lazily** — only when user opens the walkthrough tab
- Sequential Gemini calls with 4s delays between each step
- This is the most Gemini-intensive agent — 8-15 LLM calls per walkthrough
- Cache walkthrough per repo to avoid regeneration
- Use BFS from entry point nodes to trace critical paths

---

## Agent 6: SCRIBE

### Responsibility
Generate a complete onboarding document in Markdown covering the project's purpose, tech stack, architecture, key files, data flow, and setup guide.

### Input → Output

| Input | Output |
|-------|--------|
| `DependencyGraph` + `ChunkList` + `readme_content` | `OnboardingDoc` |

### Output Model

```python
# backend/app/models/onboarding.py

from pydantic import BaseModel

class DocSection(BaseModel):
    title: str
    content: str         # Markdown content
    sources: list[str]   # File paths that informed this section

class OnboardingDoc(BaseModel):
    repo_id: str
    repo_name: str
    sections: list[DocSection]
    generated_at: str
```

### Standard Sections (Generated in Order)

| # | Section | Context Sources |
|---|---------|----------------|
| 1 | **Project Purpose** | README + entry point code |
| 2 | **Tech Stack** | package.json, requirements.txt, Dockerfile, imports |
| 3 | **Architecture Overview** | Graph structure + high-level stats |
| 4 | **Key Files & Entry Points** | Entry point nodes + high-connectivity nodes |
| 5 | **Data Flow Summary** | Graph edges + service layer code |
| 6 | **Local Setup Guide** | README, Dockerfile, docker-compose, Makefile |

### Gemini Prompt Template

```
You are a senior engineer writing onboarding documentation for "{repo_name}".
Generate the "{section_title}" section.

## Available Context:
{context}

## Graph Summary:
- Total files: {total_nodes}
- Entry points: {entry_points}
- Languages: {languages}
- Key modules: {top_modules}

## Instructions:
- Write clear, concise Markdown.
- Use bullet points and code references where helpful.
- Reference specific file paths (e.g., `src/auth/login.py`).
- Assume the reader is a developer joining the project for the first time.
- DO NOT include generic advice — be specific to THIS codebase.
```

### Key Implementation Notes
- **Runs lazily** — only when user opens the docs tab
- One Gemini call per section (6 calls total)
- Each section gets tailored context from the graph/chunks/README
- Results are editable in the frontend (textarea toggle)
- Export as `.md` file or copy to clipboard

---

## Agent 7: RETRIEVER

### Responsibility
Handle user chat queries using Retrieval-Augmented Generation (RAG). Query ChromaDB for relevant chunks, build context, call Gemini for a grounded response with citations.

### Input → Output

| Input | Output |
|-------|--------|
| User question + ChromaDB collection + Chat history | `ChatResponse` |

### Output Model

```python
# backend/app/models/chat.py

from pydantic import BaseModel

class Citation(BaseModel):
    file_path: str
    start_line: int
    end_line: int
    snippet: str         # Relevant code snippet
    chunk_name: str      # Function/class name

class ChatMessage(BaseModel):
    role: str            # "user" or "assistant"
    content: str
    citations: list[Citation] = []
    timestamp: str

class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    suggested_followups: list[str]  # 2-3 follow-up questions
```

### RAG Pipeline

```
1. User Question
       │
       ▼
2. Embed query (Gemini, task_type="RETRIEVAL_QUERY", dim=768)
       │
       ▼
3. Query ChromaDB (top-K=5, filtered by repo_id)
       │
       ▼
4. Build context from retrieved chunks
   (Format: [file_path:start-end] (type: name)\n{code})
       │
       ▼
5. Call Gemini LLM with:
   - System prompt (citation instructions)
   - Retrieved context
   - Last 10 chat messages (history)
   - Current question
       │
       ▼
6. Parse response → extract answer + citations
       │
       ▼
7. Generate 2-3 follow-up question suggestions
       │
       ▼
8. Stream response to frontend via SSE
```

### ChromaDB Query Pattern

```python
results = collection.query(
    query_embeddings=[query_embedding],
    n_results=5,                          # Top-K = 5 per PRD
    where={"repo_id": current_repo_id},   # Filter to current repo
    include=["documents", "metadatas", "distances"]
)
```

### Gemini Chat System Prompt

```
You are a codebase expert for "{repo_name}". Answer questions based ONLY on the
provided context. If the context doesn't contain the answer, say so honestly.

## Rules:
1. Always cite your sources using [file_path:line_range] format.
2. Be specific — reference actual function names, class names, and file paths.
3. If multiple files are relevant, explain how they relate.
4. Keep answers concise but thorough (3-5 paragraphs max).
5. Format code references with backticks: `function_name()`.

## Retrieved Context:
{context}

## Conversation History:
{history}

## User Question:
{question}

Respond with your answer. Include citations inline like [src/auth/login.py:15-42].
After your answer, on a new line starting with "FOLLOWUPS:", list 2-3 follow-up questions.
```

### Key Implementation Notes
- Stream responses via SSE for real-time feedback
- Maintain last 10 messages in chat history for context
- Store chat history in SQLite for persistence across sessions
- Generate suggested questions on chat panel open (lightweight — based on entry points and graph structure)
- Citation chips in frontend are clickable → highlight corresponding graph node

---

## JobManager — Orchestrator

The `JobManager` coordinates the agent pipeline, manages job state, and bridges agents with the SSE event stream.

```python
# backend/app/services/job_manager.py

from enum import Enum

class JobStatus(str, Enum):
    PENDING = "pending"
    INGESTING = "ingesting"
    CHUNKING = "chunking"
    EMBEDDING = "embedding"
    GRAPHING = "graphing"
    READY = "ready"          # Core pipeline complete
    NARRATING = "narrating"  # Lazy — on demand
    SCRIBING = "scribing"    # Lazy — on demand
    FAILED = "failed"
```

### Pipeline Orchestration

```python
class JobManager:
    async def start_pipeline(self, job_id: str, source_type: str, source: str):
        """Run the core pipeline: INGEST → CHUNK → EMBED + GRAPH."""
        try:
            # Stage 1: INGEST
            ingestor = Ingestor(job_id, self.sse)
            manifest = await ingestor.run(source_type=source_type, source=source)
            
            # Stage 2: CHUNK
            chunker = Chunker(job_id, self.sse)
            chunks = await chunker.run(manifest=manifest)
            
            # Stage 3a + 3b: EMBED and GRAPH in parallel
            embedder = Embedder(job_id, self.sse)
            grapher = Grapher(job_id, self.sse)
            
            collection_name, graph = await asyncio.gather(
                embedder.run(chunk_list=chunks),
                grapher.run(manifest=manifest),
            )
            
            # Store results for lazy agents
            self.jobs[job_id] = Job(
                status=JobStatus.READY,
                manifest=manifest, chunks=chunks,
                collection_name=collection_name, graph=graph,
            )
            
        except Exception as e:
            self.jobs[job_id] = Job(status=JobStatus.FAILED, error=str(e))
    
    async def generate_walkthrough(self, job_id: str) -> Walkthrough:
        """Lazy: only runs when user requests walkthrough."""
        job = self.jobs[job_id]
        narrator = Narrator(job_id, self.sse)
        return await narrator.run(graph=job.graph, chunks=job.chunks)
    
    async def generate_docs(self, job_id: str) -> OnboardingDoc:
        """Lazy: only runs when user requests onboarding docs."""
        job = self.jobs[job_id]
        scribe = Scribe(job_id, self.sse)
        return await scribe.run(
            graph=job.graph, chunks=job.chunks,
            readme=job.manifest.readme_content,
        )
```

### SSE Event Format

```json
{
  "stage": "CHUNKER",
  "status": "running",
  "progress": 0.65,
  "message": "Chunking src/auth/login.py"
}
```

Status values: `"started"` | `"running"` | `"complete"` | `"failed"`

### SSE Implementation Notes
- Use `asyncio.Queue` per job to bridge background workers → SSE generators
- Do NOT use FastAPI `BackgroundTasks` — they run AFTER the response is sent
- Send keep-alive pings every 15s to prevent proxy timeouts
- Set headers: `Cache-Control: no-cache`, `X-Accel-Buffering: no` (for Nginx), `Connection: keep-alive`

---

## API → Agent Mapping

| Endpoint | Method | Agent(s) Involved | When |
|----------|--------|-------------------|------|
| `/api/ingest/github` | POST | INGESTOR → CHUNKER → EMBEDDER + GRAPHER | On submit |
| `/api/ingest/upload` | POST | INGESTOR → CHUNKER → EMBEDDER + GRAPHER | On submit |
| `/api/jobs/{id}/events` | GET | SSE stream from all agents | During pipeline |
| `/api/graph/{id}` | GET | Returns GRAPHER output | After pipeline |
| `/api/graph/{id}/node/{nid}` | GET | May trigger AI summary (Gemini) | On node click |
| `/api/walkthrough/{id}` | GET | NARRATOR (lazy generation) | On first request |
| `/api/docs/{id}` | GET | SCRIBE (lazy generation) | On first request |
| `/api/chat/{id}` | POST | RETRIEVER | Per chat message |
| `/api/chat/{id}/suggestions` | GET | RETRIEVER (lightweight) | On chat open |

---

## Data Flow Between Agents

```
                    FileManifest
INGESTOR ──────────────┬──────────────────► GRAPHER ──► DependencyGraph
                       │                                     │
                       ▼                                     │
                    ChunkList                                │
CHUNKER ──────────────┬──────────────────────────────────────┤
                       │                                     │
                       ▼                                     ▼
                 ChromaDB Collection              ┌──── NARRATOR ──► Walkthrough
EMBEDDER ──────────────┤                          │
                       │                          ├──── SCRIBE ────► OnboardingDoc
                       ▼                          │
                  Vector Store ───────────────────┴──── RETRIEVER ──► ChatResponse
```

---

## Error Isolation

Each agent can fail independently without crashing the pipeline:

| Failed Agent | Impact | Graceful Degradation |
|-------------|--------|---------------------|
| INGESTOR | Fatal — nothing works | Show error, let user retry |
| CHUNKER | Fatal — no embeddings or graph | Show error, let user retry |
| EMBEDDER | No chat Q&A | Graph + walkthrough still work (without RAG) |
| GRAPHER | No visual graph | Chat + docs still work |
| NARRATOR | No walkthrough | Graph + chat + docs still work |
| SCRIBE | No onboarding docs | Graph + chat + walkthrough still work |
| RETRIEVER | No chat | Graph + walkthrough + docs still work |

> **Design for partial success.** If GRAPHER fails but EMBEDDER succeeds, the user can still use chat Q&A. Show clear indicators in the UI of which features are available vs. unavailable for the current job.

---

## Gemini Rate Limit Budget

With 15 RPM / 1500 RPD limits, here's the budget per repo ingestion:

| Agent | Gemini Calls | Type | Notes |
|-------|-------------|------|-------|
| EMBEDDER | ~N/10 calls | Embedding | N = total chunks, batched by 10 |
| GRAPHER (summaries) | ~M calls | LLM | M = total nodes, lazy per-click |
| NARRATOR | 8-15 calls | LLM | Lazy, one per walkthrough step |
| SCRIBE | 6 calls | LLM | Lazy, one per section |
| RETRIEVER | 2 calls/question | Embedding + LLM | Per chat message |

**Example: 50-file repo with ~200 chunks**
- EMBEDDER: 20 embedding calls (~80s with 4s gaps)
- NARRATOR: 12 LLM calls (~48s with 4s gaps) — lazy
- SCRIBE: 6 LLM calls (~24s with 4s gaps) — lazy
- Total initial pipeline: ~20 API calls
- Total with all features: ~38 API calls
- Well within 1500 RPD limit for ~39 repos/day
