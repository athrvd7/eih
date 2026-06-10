# Engineering Intelligence Hub (EIH)

**AI-powered codebase intelligence for faster onboarding, architecture discovery, and grounded code Q&A.**

EIH ingests a GitHub repository, ZIP archive, or documentation bundle, then turns it into an interactive codebase workspace with:

- A visual dependency graph.
- A lazy AI-generated walkthrough.
- A lazy onboarding document generator.
- A retrieval-augmented chat experience with citations.
- Real-time ingestion progress through Server-Sent Events.

**Motto:** Build it. Ship it. Understand it.

---

## Table of Contents

1. [Status](#status)
2. [What EIH Does](#what-eih-does)
3. [Supported Inputs](#supported-inputs)
4. [Architecture](#architecture)
5. [Agent Pipeline](#agent-pipeline)
6. [Tech Stack](#tech-stack)
7. [Project Structure](#project-structure)
8. [Quick Start](#quick-start)
9. [Docker Compose](#docker-compose)
10. [Environment Variables](#environment-variables)
11. [API Usage](#api-usage)
12. [Frontend Routes](#frontend-routes)
13. [Data Models](#data-models)
14. [Rate Limits and Cost Controls](#rate-limits-and-cost-controls)
15. [Partial Failure Behavior](#partial-failure-behavior)
16. [Development](#development)
17. [Troubleshooting](#troubleshooting)
18. [Known MVP Limitations](#known-mvp-limitations)
19. [Roadmap](#roadmap)
20. [Implementation References](#implementation-references)

---

## Status

**Current stage:** MVP / active implementation.

EIH is designed as a self-hostable monorepo with a FastAPI backend, React/Vite frontend, Gemini-powered AI services, and ChromaDB vector storage. The core ingestion pipeline is implemented, and several AI features are present but intentionally lazy so they do not consume Gemini quota during every repository ingestion.

---

## What EIH Does

EIH helps developers understand unfamiliar codebases by combining static analysis, vector search, and AI-generated explanations.

### Core Capabilities

| Capability | Description |
|---|---|
| Repository ingestion | Clone public GitHub repositories, extract ZIP uploads, or ingest documentation files. |
| Semantic chunking | Split source and documentation files into searchable chunks. |
| Vector indexing | Embed chunks with Gemini Embeddings and store them in ChromaDB. |
| Dependency graphing | Build a file-level dependency graph from local import relationships. |
| Guided walkthrough | Generate an ordered codebase tour from entry points and high-connectivity files. |
| Onboarding docs | Generate a Markdown onboarding document with project purpose, stack, architecture, key files, data flow, and setup guidance. |
| Code Q&A | Answer user questions with retrieved chunks and source citations. |
| Progress streaming | Stream job progress to the UI via SSE. |

---

## Supported Inputs

EIH accepts three ingestion sources:

### Public GitHub URLs

Example:

```bash
https://github.com/owner/repo
```

The GitHub ingestor clones the repository with a shallow clone and filters relevant files before chunking and indexing.

### ZIP Archives

Upload a `.zip` archive containing a project.

Supported upload size is controlled by `MAX_UPLOAD_MB`; the default is `100`.

### Documentation Files

Upload one or more documentation files with these extensions:

- `.md`
- `.txt`
- `.rst`

Documentation-only jobs are useful when you want onboarding or Q&A over docs without a full source repository.

---

## Architecture

```
User Input: GitHub URL / ZIP / Docs
        │
        ▼
┌─────────────┐
│ INGESTOR    │ Clone, extract, filter, build FileManifest
└──────┬──────┘
       │ FileManifest
       ▼
┌─────────────┐
│ CHUNKER     │ tree-sitter + heading-based + fallback chunking
└──────┬──────┘
       │ ChunkList
       ▼
┌─────────────┐        ┌────────────────────┐
│ EMBEDDER    │ ◄────► │ ChromaDB Collection │
└─────────────┘        └────────────────────┘

FileManifest
       │
       ▼
┌─────────────┐
│ GRAPHER     │ Heuristic import resolution and node classification
└──────┬──────┘
       │ DependencyGraph
       ├──────────────────────► NARRATOR (lazy)
       ├──────────────────────► SCRIBE (lazy)
       └──────────────────────► Frontend Graph UI

ChromaDB Collection
       │
       ▼
RETRIEVER (per chat message)
```

---

## Agent Pipeline

| Stage | Agent | Trigger | Gemini API? | Output |
|---:|---|---|---|---|
| 1 | `INGESTOR` | User submits GitHub URL, ZIP, or docs | No | `FileManifest` |
| 2 | `CHUNKER` | After ingestion completes | No | `ChunkList` |
| 3a | `EMBEDDER` | After chunking completes | Yes | ChromaDB collection |
| 3b | `GRAPHER` | Runs in parallel with `EMBEDDER` | No | `DependencyGraph` |
| 4a | `NARRATOR` | Lazy, when walkthrough is requested | Yes | `Walkthrough` |
| 4b | `SCRIBE` | Lazy, when docs are requested | Yes | `OnboardingDoc` |
| 5 | `RETRIEVER` | Per chat message | Yes | `ChatResponse` |

**Important:** `NARRATOR` and `SCRIBE` are intentionally lazy. They are not run during initial ingestion, which helps avoid Gemini rate-limit pressure.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS |
| UI components | shadcn-style utilities, Lucide icons |
| Graph visualization | React Flow (`@xyflow/react`) with Dagre layout |
| Backend | FastAPI, Python 3.12 |
| AI | Gemini 2.5 Flash and Gemini Embeddings |
| Vector store | ChromaDB |
| Parsing | `tree-sitter`, `tree-sitter-python`, `tree-sitter-javascript`, `tree-sitter-typescript` |
| Repository cloning | GitPython |
| State management | Zustand |
| Routing | React Router |
| Containerization | Docker Compose |
| Persistence | SQLite for jobs, graph metadata, docs, walkthroughs, and chat history |

---

## Project Structure

```text
eih-project/
├── backend/
│   ├── app/
│   │   ├── agents/       # Multi-agent pipeline implementations
│   │   ├── models/       # Pydantic schemas
│   │   ├── routers/      # FastAPI route handlers
│   │   ├── services/     # Gemini, ChromaDB, SSE, database, job orchestration
│   │   └── utils/        # File, Git, and rate-limit utilities
│   ├── prompts/          # Versioned prompt templates
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/   # Graph, chat, walkthrough, docs, landing UI
│   │   ├── hooks/        # React hooks such as SSE connection handling
│   │   ├── lib/          # Graph layout and utilities
│   │   ├── pages/        # Landing, ingestion, and workspace pages
│   │   ├── services/     # API client
│   │   ├── stores/       # Zustand stores
│   │   └── types/        # Shared TypeScript types
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
├── prd.md
├── implementation-plan.md
├── implementation.md
├── agents.md
└── README.md
```

---

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker and Docker Compose
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### 1. Configure the Gemini API key

Create a local `.env` file from the example:

```bash
cp .env.example .env
```

Then set your Gemini key:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

---

### 2. Start the full stack with Docker Compose

From the repository root:

```bash
docker compose up --build
```

Open the app:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:8001
ChromaDB: http://localhost:8000
```

---

### 3. Run the backend locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

On Windows PowerShell:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

---

### 4. Run ChromaDB locally

If you are not using Docker Compose, start ChromaDB separately:

```bash
docker run -d \
  --name eih-chroma \
  -p 8000:8000 \
  -e IS_PERSISTENT=TRUE \
  -e ANONYMIZED_TELEMETRY=FALSE \
  -e CHROMA_SERVER_HOST=0.0.0.0 \
  chromadb/chroma:latest
```

If ChromaDB is unavailable, the backend falls back to an in-memory Chroma client so the rest of the pipeline can still run during local development.

---

### 5. Run the frontend locally

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs on:

```text
http://localhost:5173
```

---

## Docker Compose

The Compose file defines three services:

| Service | Purpose |
|---|---|
| `chromadb` | Persistent vector database on port `8000`. |
| `backend` | FastAPI API on port `8001`. |
| `frontend` | Production-built React app served by Nginx on port `5173`. |

Useful commands:

```bash
# Start everything
docker compose up --build

# Start in detached mode
docker compose up -d --build

# View logs
docker compose logs -f

# Stop everything
docker compose down

# Stop and remove volumes
docker compose down -v
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure the values you need.

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here

# ChromaDB
CHROMA_HOST=localhost
CHROMA_PORT=8000

# Storage
REPOS_DIR=/tmp/eih_repos
DB_PATH=./eih.db

# Limits
MAX_UPLOAD_MB=100
MAX_REPO_MB=500
MAX_FILES=500

# App
APP_ENV=development
LOG_LEVEL=INFO
FRONTEND_URL=http://localhost:5173
```

### Notes

- `GEMINI_API_KEY` is required for embeddings, walkthrough generation, onboarding docs, node summaries, and chat.
- `CHROMA_HOST` should be `chromadb` when running through Docker Compose.
- `REPOS_DIR` stores cloned repositories and extracted ZIP files.
- `MAX_UPLOAD_MB` controls the maximum ZIP upload size.
- `MAX_REPO_MB` is available for future repository-size guardrails.
- `MAX_FILES` is available for future file-count guardrails.

---

## API Usage

The FastAPI app exposes interactive API documentation at:

```text
http://localhost:8001/docs
```

### Submit a GitHub repository

```bash
curl -X POST "http://localhost:8001/api/ingest/github" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com/owner/repo"}'
```

Response:

```json
{
  "job_id": "uuid-string",
  "status": "pending"
}
```

### Upload a ZIP archive

```bash
curl -X POST "http://localhost:8001/api/ingest/upload" \
  -F "file=@/path/to/project.zip"
```

### Upload documentation files

```bash
curl -X POST "http://localhost:8001/api/ingest/docs" \
  -F "files=@README.md" \
  -F "files=@docs/architecture.md"
```

### Stream ingestion progress

```bash
curl -N "http://localhost:8001/api/jobs/{job_id}/events"
```

Example SSE event:

```json
{
  "stage": "pipeline",
  "status": "running",
  "progress": 0.5,
  "message": "Embedding and graphing..."
}
```

### Get job status

```bash
curl "http://localhost:8001/api/jobs/{job_id}"
```

### Get dependency graph

```bash
curl "http://localhost:8001/api/graph/{job_id}"
```

### Get node details

```bash
curl "http://localhost:8001/api/graph/{job_id}/node/{encoded_node_id}"
```

### Generate or fetch walkthrough

```bash
curl "http://localhost:8001/api/walkthrough/{job_id}"
```

### Generate or fetch onboarding docs

```bash
curl "http://localhost:8001/api/docs/{job_id}"
```

### Update edited onboarding docs

```bash
curl -X PUT "http://localhost:8001/api/docs/{job_id}" \
  -H "Content-Type: application/json" \
  -d '{"sections":[{"title":"Project Purpose","content":"...","sources":[]}]}'
```

### Ask a codebase question

```bash
curl -X POST "http://localhost:8001/api/chat/{job_id}" \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the main entry point?"}'
```

### Get chat history

```bash
curl "http://localhost:8001/api/chat/{job_id}/history"
```

### Get suggested chat questions

```bash
curl "http://localhost:8001/api/chat/{job_id}/suggestions"
```

---

## Frontend Routes

| Route | Page | Purpose |
|---|---|---|
| `/` | Landing page | Product overview and feature summary. |
| `/analyze` | Ingestion page | Submit GitHub URL, ZIP upload, or docs. |
| `/workspace/:jobId` | Workspace page | Graph explorer, walkthrough, docs, and chat for a completed job. |

---

## Data Models

### `FileManifest`

Produced by `INGESTOR`.

```python
class FileEntry(BaseModel):
    path: str
    language: str
    size_bytes: int
    content: str
    sha256: str

class FileManifest(BaseModel):
    repo_id: str
    repo_name: str
    total_files: int
    files: list[FileEntry]
    readme_content: str | None
```

### `ChunkList`

Produced by `CHUNKER`.

```python
class Chunk(BaseModel):
    id: str
    file_path: str
    chunk_type: ChunkType
    name: str
    start_line: int
    end_line: int
    content: str
    language: str
    parent_class: str | None
    imports: list[str]

class ChunkList(BaseModel):
    repo_id: str
    total_chunks: int
    chunks: list[Chunk]
```

### `DependencyGraph`

Produced by `GRAPHER`.

```python
class GraphNode(BaseModel):
    id: str
    label: str
    type: NodeType
    language: str
    summary: str | None = None
    lines_of_code: int

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relation: EdgeRelation
    imported_symbols: list[str]

class DependencyGraph(BaseModel):
    repo_id: str
    repo_name: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    entry_points: list[str]
```

### `Walkthrough`

Produced lazily by `NARRATOR`.

```python
class WalkthroughStep(BaseModel):
    order: int
    title: str
    file_path: str
    explanation: str
    code_snippet: str
    snippet_start_line: int
    snippet_end_line: int
    related_files: list[str]
    graph_node_ids: list[str]
    concepts: list[str]

class Walkthrough(BaseModel):
    repo_id: str
    repo_name: str
    total_steps: int
    steps: list[WalkthroughStep]
    generated_at: str
```

### `OnboardingDoc`

Produced lazily by `SCRIBE`.

```python
class DocSection(BaseModel):
    title: str
    content: str
    sources: list[str]

class OnboardingDoc(BaseModel):
    repo_id: str
    repo_name: str
    sections: list[DocSection]
    generated_at: str
```

### `ChatResponse`

Produced by `RETRIEVER`.

```python
class Citation(BaseModel):
    file_path: str
    start_line: int
    end_line: int
    snippet: str
    chunk_name: str

class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    suggested_followups: list[str]
```

---

## Rate Limits and Cost Controls

EIH is designed around Gemini API limits and cost-aware behavior.

| Area | Strategy |
|---|---|
| Embeddings | 768-dimensional vectors to reduce ChromaDB storage. |
| Embedding batching | Chunks are embedded in batches of 10. |
| Gemini calls | A token-bucket rate limiter keeps calls around a safe 12 RPM ceiling. |
| Retries | Gemini calls use exponential backoff with up to 3 attempts. |
| Lazy AI | Walkthrough and onboarding docs are generated only when requested. |
| Caching | Jobs, graph metadata, walkthroughs, docs, and chat history are persisted in SQLite. |

### Current Gemini usage

| Feature | Gemini model |
|---|---|
| Embeddings | `gemini-embedding-001` |
| Node summaries | `gemini-2.5-flash` |
| Walkthrough | `gemini-2.5-flash` |
| Onboarding docs | `gemini-2.5-flash` |
| Chat answers | `gemini-2.5-flash` |

---

## Partial Failure Behavior

EIH is designed so one failed component does not necessarily block the whole workspace.

| Failed Component | Impact | Graceful Degradation |
|---|---|---|
| `INGESTOR` | Fatal | Ingestion fails and the user can retry. |
| `CHUNKER` | Fatal | No chunks are available for embeddings or chat. |
| `EMBEDDER` | Chat unavailable | Graph can still be shown if graphing succeeds. |
| `GRAPHER` | Graph unavailable | Chat can still work if embeddings succeed. |
| `NARRATOR` | Walkthrough unavailable | Graph, docs, and chat remain available. |
| `SCRIBE` | Docs unavailable | Graph, walkthrough, and chat remain available. |
| `RETRIEVER` | Chat unavailable | Graph, walkthrough, and docs remain available. |

The pipeline records partial results where possible and exposes job status through the `/api/jobs/{job_id}` endpoint.

---

## Development

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Recommended local environment:

```env
APP_ENV=development
LOG_LEVEL=INFO
CHROMA_HOST=localhost
CHROMA_PORT=8000
FRONTEND_URL=http://localhost:5173
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Available frontend scripts:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

### Type-check and build

```bash
cd frontend
npm run build
```

### Lint frontend

```bash
cd frontend
npm run lint
```

### View API docs

With the backend running:

```text
http://localhost:8001/docs
```

---

## Troubleshooting

### `Gemini API key is missing`

Set `GEMINI_API_KEY` in `.env` and restart the backend.

### `ChromaDB HTTP client unavailable`

The backend logs a warning and falls back to an in-memory Chroma client. For persistent vectors, start ChromaDB with Docker Compose.

### `Only public GitHub URLs are supported`

The current ingestor accepts public GitHub URLs beginning with `https://github.com/`. Private repositories, GitHub OAuth, and personal access tokens are not implemented yet.

### `Only ZIP files are supported`

The upload endpoint currently accepts `.zip` archives only.

### `Graph has very few or no edges`

The current grapher uses heuristic import resolution. It is useful for visualization and navigation, but it is not yet a full AST-based dependency resolver for every language or package style.

### `Walkthrough or docs generation fails`

The lazy AI agents catch failures and return fallback sections where possible. If every AI section fails, check the Gemini API key, quota, and backend logs.

### Frontend cannot reach the backend

The Vite dev server proxies `/api` requests to `http://localhost:8001`. Make sure the backend is running on port `8001`.

---

## Known MVP Limitations

- Private GitHub repositories are not supported.
- GitHub OAuth and personal access tokens are not implemented.
- ZIP upload is the only local project upload format.
- The current grapher is heuristic and may miss complex imports, aliases, monorepo paths, or package-resolution edge cases.
- Chat currently returns a JSON response rather than streaming token-by-token.
- AI summaries, walkthroughs, and docs depend on Gemini availability and rate limits.
- Repository synchronization, webhooks, multi-user auth, RBAC, and team workspaces are deferred to future versions.

---

## Roadmap

### Near-term

- Improve import/export resolution with deeper AST parsing.
- Add graph clustering for large repositories.
- Add better empty, loading, and error states across the workspace.
- Add more backend unit tests for agents and import resolution.
- Add frontend component tests for graph, chat, walkthrough, and docs panels.

### Future

- Private repository support with GitHub OAuth or personal access tokens.
- Webhook-based repository re-indexing.
- Multi-user authentication and team workspaces.
- Token-by-token chat streaming.
- VS Code extension or embedded IDE panel.
- Commit-to-commit architecture diffing.
- Folder-level graph clustering and focus modes for very large repositories.

---

## Implementation References

This README describes the current implementation in this repository. Key implementation entry points include:

| Area | Reference |
|---|---|
| FastAPI router registration | `backend/app/main.py:44-49` |
| Health check and API root | `backend/app/main.py:52-59` |
| Ingestion endpoints | `backend/app/routers/ingest.py:19-99` |
| Job status and SSE events | `backend/app/routers/jobs.py:15-81` |
| Graph retrieval and node details | `backend/app/routers/graph.py:16-82` |
| Walkthrough endpoint | `backend/app/routers/walkthrough.py:15-37` |
| Onboarding docs endpoints | `backend/app/routers/docs.py:16-59` |
| Chat endpoints | `backend/app/routers/chat.py:15-97` |
| Pipeline orchestration | `backend/app/services/job_manager.py:82-168` |
| Lazy walkthrough generation | `backend/app/services/job_manager.py:180-208` |
| Lazy docs generation | `backend/app/services/job_manager.py:210-238` |
| Ingestor source handling | `backend/app/agents/ingestor.py:24-46` |
| Chunker strategies | `backend/app/agents/chunker.py:16-24` |
| Embedder behavior | `backend/app/agents/embedder.py:15-23` |
| Grapher behavior | `backend/app/agents/grapher.py:40-48` |
| Narrator behavior | `backend/app/agents/narrator.py:38-49` |
| Scribe behavior | `backend/app/agents/scribe.py:88-100` |
| Retriever behavior | `backend/app/agents/retriever.py:31-50` |
| Gemini text generation and embeddings | `backend/app/services/gemini_client.py:28-78` |
| Gemini rate limiting | `backend/app/utils/rate_limiter.py:12-51` |
| ChromaDB client and fallback | `backend/app/services/vector_store.py:24-49` |
| Docker Compose services | `docker-compose.yml:1-51` |
| Backend container | `backend/Dockerfile:1-19` |
| Frontend container | `frontend/Dockerfile:1-14` |
| Environment variable schema | `.env.example:1-20` and `backend/app/config.py:12-31` |
| Frontend routes | `frontend/src/App.tsx:10-15` |
| Frontend API client | `frontend/src/services/api.ts:25-89` |
| Frontend SSE hook | `frontend/src/hooks/useSSE.ts:10-26` |

---

## Contributing

When working on EIH, keep changes focused and testable:

1. Add or update tests for backend agents and routers.
2. Run the frontend build after UI changes.
3. Keep AI features lazy where possible to avoid unnecessary Gemini usage.
4. Prefer graceful degradation over hard failures.
5. Document new environment variables in `.env.example:1-20` and `backend/app/config.py:12-31`.

---

## License

No license file is included in this repository yet. Add a `LICENSE` file before distributing EIH publicly.
