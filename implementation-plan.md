# Engineering Intelligence Hub — Implementation Plan

**Version:** 1.0  
**Date:** June 2026  
**Author:** Atharva Dahake  
**Derived from:** [prd.md](file:///Users/atharvadahake/Downloads/eih-project/prd.md)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [Phase 0 — Project Scaffolding & DevOps](#phase-0--project-scaffolding--devops-days-1-2)
4. [Phase 1 — Foundation (Ingest → Chunk → Embed)](#phase-1--foundation-ingest--chunk--embed-days-3-8)
5. [Phase 2 — Graph Intelligence](#phase-2--graph-intelligence-days-9-14)
6. [Phase 3 — AI Intelligence Layer](#phase-3--ai-intelligence-layer-days-15-20)
7. [Phase 4 — Polish & Production Readiness](#phase-4--polish--production-readiness-days-21-26)
8. [Suggestions & Design Decisions](#suggestions--design-decisions)
9. [Risk Mitigations](#risk-mitigations)
10. [Testing Strategy](#testing-strategy)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│  React + Vite + TypeScript + Tailwind + shadcn/ui           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Home/    │  │ Graph    │  │ Walk-    │  │ Chat       │  │
│  │ Ingest   │  │ View     │  │ through  │  │ Panel      │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│                    React Flow                               │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST + SSE
┌──────────────────────▼──────────────────────────────────────┐
│                       BACKEND                               │
│  FastAPI + Python 3.12+                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              JobManager (Orchestrator)                │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐  │   │
│  │  │INGESTOR │→│CHUNKER  │→│EMBEDDER │→│ GRAPHER   │  │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └───────────┘  │   │
│  │                                                      │   │
│  │  ┌─────────┐ ┌─────────┐ ┌───────────┐              │   │
│  │  │NARRATOR │ │ SCRIBE  │ │ RETRIEVER │              │   │
│  │  └─────────┘ └─────────┘ └───────────┘              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐              │
│  │ ChromaDB │  │ File     │  │ Gemini 2.5   │              │
│  │ (Vectors)│  │ Storage  │  │ Flash API    │              │
│  └──────────┘  └──────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Project Structure

```
eih-project/
├── frontend/                  # React + Vite app
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/            # shadcn/ui components
│   │   │   ├── graph/         # React Flow graph components
│   │   │   ├── chat/          # Chat panel components
│   │   │   ├── walkthrough/   # Walkthrough viewer
│   │   │   └── docs/          # Doc generator UI
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # API client & SSE handlers
│   │   ├── stores/            # State management (Zustand)
│   │   ├── pages/             # Route-level pages
│   │   ├── types/             # TypeScript interfaces
│   │   └── lib/               # Utilities
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                   # FastAPI application
│   ├── app/
│   │   ├── main.py            # FastAPI app entry point
│   │   ├── config.py          # Settings & env vars
│   │   ├── models/            # Pydantic schemas
│   │   ├── routers/           # API route handlers
│   │   │   ├── ingest.py
│   │   │   ├── graph.py
│   │   │   ├── walkthrough.py
│   │   │   ├── docs.py
│   │   │   ├── chat.py
│   │   │   └── jobs.py
│   │   ├── agents/            # Agent implementations
│   │   │   ├── base.py        # Base agent class
│   │   │   ├── ingestor.py
│   │   │   ├── chunker.py
│   │   │   ├── embedder.py
│   │   │   ├── grapher.py
│   │   │   ├── narrator.py
│   │   │   ├── scribe.py
│   │   │   └── retriever.py
│   │   ├── services/          # Business logic
│   │   │   ├── job_manager.py
│   │   │   ├── gemini_client.py
│   │   │   ├── vector_store.py
│   │   │   └── sse_manager.py
│   │   └── utils/             # Helpers
│   │       ├── file_utils.py
│   │       ├── git_utils.py
│   │       └── rate_limiter.py
│   ├── prompts/               # Versioned prompt templates
│   │   ├── node_summary.txt
│   │   ├── walkthrough.txt
│   │   ├── onboarding.txt
│   │   └── chat_system.txt
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
├── README.md
├── prd.md
├── implementation-plan.md
└── agents.md
```

> **Suggestion:** Use **Zustand** for state management instead of Redux — it's lighter, simpler, and perfect for a solo-dev project. The graph state, chat history, and job status can each be separate stores.

---

## Phase 0 — Project Scaffolding & DevOps (Days 1-2)

### Goals
- Set up the monorepo structure
- Initialize frontend and backend projects
- Configure Docker Compose for development
- Set up environment variables and configuration

### Tasks

| # | Task | Details | Est. |
|---|------|---------|------|
| 0.1 | **Init frontend** | `npx -y create-vite@latest ./ -- --template react-ts` in `frontend/` | 1h |
| 0.2 | **Install frontend deps** | Tailwind CSS v4, shadcn/ui, React Flow (`@xyflow/react`), Zustand, react-router-dom, react-syntax-highlighter, lucide-react, dagre | 1h |
| 0.3 | **Init backend** | Create FastAPI project with `uvicorn`, set up virtual env | 1h |
| 0.4 | **Install backend deps** | fastapi, uvicorn, chromadb, gitpython, google-genai, tree-sitter, tree-sitter-python, tree-sitter-javascript, tree-sitter-typescript, python-multipart, pydantic-settings, tenacity, aiosqlite | 1h |
| 0.5 | **Docker Compose** | Define services: `frontend`, `backend`, `chromadb`. ChromaDB as separate container with persistent volume. | 2h |
| 0.6 | **Environment config** | `.env.example` with `GEMINI_API_KEY`, `CHROMA_HOST`, `CHROMA_PORT`, `MAX_UPLOAD_MB`, `MAX_REPO_MB` | 30m |
| 0.7 | **Dev tooling** | ESLint, Prettier (frontend), Ruff, mypy (backend) | 1h |
| 0.8 | **CI skeleton** | Basic GitHub Actions for lint + type-check | 1h |

### Key Technical Notes

- **Vite:** Use `import.meta.env` with `VITE_` prefix (NOT `process.env`)
- **Docker dev mode:** Set `server.watch.usePolling: true` in vite.config for hot reload
- **ChromaDB Docker:** Use `chromadb/chroma:latest` image with `IS_PERSISTENT=TRUE` and `ANONYMIZED_TELEMETRY=FALSE`
- **Backend Dockerfile:** Must install `git` — required by GitPython: `RUN apt-get install -y git`
- **CORS:** Configure FastAPI CORS middleware for frontend port

### Deliverables
- ✅ Working `docker compose up` that starts frontend + backend + ChromaDB
- ✅ Frontend renders at `localhost:5173`, backend at `localhost:8000/docs`
- ✅ Health check endpoints operational

### Suggestions

> **IMPORTANT: Run ChromaDB as a separate Docker service** instead of in-process. This avoids memory leaks in the backend container and lets you persist vectors independently.

> **Use `pydantic-settings`** for config management — it auto-reads `.env` files and validates environment variables with types.

---

## Phase 1 — Foundation: Ingest → Chunk → Embed (Days 3-8)

### Goals
- Build the ingestion pipeline (GitHub URL + ZIP upload + docs)
- Implement semantic code chunking with tree-sitter
- Generate and store embeddings in ChromaDB
- Deliver progress updates via SSE

### Tasks

| # | Task | Details | Est. |
|---|------|---------|------|
| **Backend** | | | |
| 1.1 | **INGESTOR agent** | Clone repos via GitPython (shallow `depth=1`), extract ZIPs, walk file tree, filter by extension whitelist. Ignore `node_modules/`, `.git/`, `dist/`, `__pycache__/`, `venv/`. Use `asyncio.to_thread` for blocking GitPython calls. | 4h |
| 1.2 | **File manifest model** | Pydantic model: `FileManifest(path, language, size_bytes, content, sha256)` | 1h |
| 1.3 | **CHUNKER agent** | tree-sitter AST parsing for Python & JS/TS. Use pre-compiled wheels (`tree-sitter-python`, `tree-sitter-javascript`, `tree-sitter-typescript`). Extract function/class/method boundaries. Fallback to sliding-window chunking (500 tokens, 50 overlap) for unsupported languages. Markdown → heading-based sections. | 6h |
| 1.4 | **Chunk metadata model** | `Chunk(id, file_path, chunk_type, name, start_line, end_line, content, language, parent_class?)` — deterministic IDs: `{file_path}::{type}::{name}::{start_line}` | 1h |
| 1.5 | **EMBEDDER agent** | Gemini Embedding API (`gemini-embedding-001`) with batching (10 chunks/batch, 4s delay). Use `task_type="RETRIEVAL_DOCUMENT"`, `output_dimensionality=768`. Store in ChromaDB with `hnsw:space="cosine"`. | 4h |
| 1.6 | **Rate limiter service** | Use `tenacity` library for exponential backoff (2s→4s→8s) on 429 errors. Track RPM via sliding window. | 3h |
| 1.7 | **JobManager v1** | Background task orchestrator using `asyncio.Queue` to bridge workers → SSE. States: `PENDING → INGESTING → CHUNKING → EMBEDDING → COMPLETE / FAILED`. | 4h |
| 1.8 | **SSE endpoint** | `GET /api/jobs/{job_id}/events` — use `StreamingResponse` with `async def event_generator()`. Set headers: `Cache-Control: no-cache`, `X-Accel-Buffering: no`, `Connection: keep-alive`. Send keep-alive pings every 15s. | 2h |
| 1.9 | **Repository caching** | Hash repo URL + commit SHA. Skip re-processing if already indexed. Store hash → job_id mapping in SQLite. | 2h |
| **Frontend** | | | |
| 1.10 | **Home page** | GitHub URL input, drag-drop ZIP upload, file picker for docs. Quick-start cards (facebook/react, vercel/next.js). | 4h |
| 1.11 | **Progress tracker** | SSE-connected progress bar using `EventSource` API. States: Ingesting → Chunking → Embedding → Ready. | 3h |
| 1.12 | **API client service** | Fetch wrapper for all backend endpoints. Custom `useSSE` hook for event streaming. | 2h |

### API Endpoints

```
POST /api/ingest/github     { url: string }                    → { job_id }
POST /api/ingest/upload      FormData(file: ZIP)                → { job_id }
POST /api/ingest/docs        FormData(files: .md/.txt/.rst[])   → { job_id }
GET  /api/jobs/{job_id}                                         → { status, progress }
GET  /api/jobs/{job_id}/events                                  → SSE stream
```

### Deliverables
- ✅ User submits a GitHub URL → repo is cloned, chunked, embedded in ChromaDB
- ✅ User uploads a ZIP → same pipeline
- ✅ Real-time progress in the UI via SSE
- ✅ Cached repos skip re-processing

### Suggestions

> **Add a file-count pre-check before ingestion.** After cloning, count relevant files and warn the user if >200 files. This prevents silent long waits and lets users opt to filter directories.

> **WARNING: tree-sitter language grammars need pre-compiled wheels.** Use `tree-sitter-python`, `tree-sitter-javascript`, `tree-sitter-typescript` packages. The old `tree-sitter-languages` meta-package is deprecated.

> **Suggestion: Add `.eihignore` file support** — similar to `.gitignore`, let users exclude directories/files from indexing (e.g., `tests/`, `migrations/`, `vendor/`).

> **SSE Architecture Note:** Do NOT use FastAPI `BackgroundTasks` to drive SSE streams — they run AFTER the response is sent. Use `asyncio.Queue` per job to bridge background workers with SSE generators.

---

## Phase 2 — Graph Intelligence (Days 9-14)

### Goals
- Build the GRAPHER agent to parse imports/exports and construct a dependency graph
- Build the React Flow interactive graph UI
- Implement node details panel with AI summaries
- Add filters, color coding, and export

### Tasks

| # | Task | Details | Est. |
|---|------|---------|------|
| **Backend** | | | |
| 2.1 | **GRAPHER agent — Import parser** | Use tree-sitter AST queries to extract `import`/`require`/`from...import` statements. Resolve relative paths (Python: `auth.login` → `auth/login.py`, JS/TS: `./auth/login` → try `.ts`, `.tsx`, `.js`, `/index.ts`). Build adjacency list. | 6h |
| 2.2 | **GRAPHER agent — Export parser** | Detect `export`, `module.exports`, `__all__`. Tag entry-point files (`main.py`, `index.ts`, `app.py`). | 3h |
| 2.3 | **Graph JSON schema** | `{ nodes: [{ id, path, type, language, summary? }], edges: [{ source, target, relation }] }` — format compatible with React Flow | 1h |
| 2.4 | **Node classification** | Auto-classify nodes: entry_point, component, service, utility, config, test. Use heuristics (path patterns + connection analysis). | 3h |
| 2.5 | **AI node summary** | Gemini 2.5 Flash generates 1-2 sentence summaries per node. Batch to stay within rate limits. Cache summaries. | 3h |
| **Frontend** | | | |
| 2.6 | **React Flow graph** | Use `@xyflow/react` with `dagre` layout engine. Wrap custom nodes in `React.memo` (critical for perf). Parent container MUST have explicit height. Import React Flow CSS AFTER Tailwind CSS. | 6h |
| 2.7 | **Graph interactions** | Zoom, pan, drag. Minimap (`<MiniMap />`). Fit-to-view button. `useNodesState`/`useEdgesState` hooks. | 2h |
| 2.8 | **Node details panel** | Click node → right panel shows: file path, AI summary, dependencies list, dependents list, code preview with syntax highlighting. | 4h |
| 2.9 | **Graph filters** | File type filter (checkboxes), folder/module filter (tree), depth slider, search-by-filename. | 3h |
| 2.10 | **Export** | Export graph as PNG (`html-to-image`) and SVG. | 2h |
| 2.11 | **Main workspace layout** | Left sidebar (file tree + chat toggle), center (graph), right panel (details). Top bar (repo name, view switcher, export). | 4h |

### API Endpoints

```
GET  /api/graph/{job_id}                → { nodes, edges }
GET  /api/graph/{job_id}/node/{node_id} → { path, summary, deps, dependents, code }
```

### Deliverables
- ✅ Interactive force-directed dependency graph renders in the browser
- ✅ Nodes are color-coded by type (entry=green, component=blue, service=orange, utility=grey)
- ✅ Clicking a node shows AI summary + dependency info
- ✅ Filters work (file type, folder, depth)
- ✅ Export to PNG/SVG

### Suggestions

> **IMPORTANT: Use `dagre` for the initial graph layout.** React Flow has NO built-in layout engine. Install: `npm install dagre @types/dagre`. Dagre gives clean hierarchical layouts that are much more readable than random placement.

> **For dense graphs (300+ nodes):** Implement **folder clustering** — collapse all files in a directory into a single "folder node" by default. Users can double-click to expand.

> **Suggestion: Add "Focus Mode"** — when a user clicks a node, dim all nodes that are not direct dependencies/dependents (CSS opacity: 0.15). Reduces visual noise dramatically.

> **React Flow Gotcha:** The parent container MUST have explicit `height` and `width` (e.g., `height: 100vh`). Without this, the graph won't render.

---

## Phase 3 — AI Intelligence Layer (Days 15-20)

### Goals
- Build the NARRATOR agent for guided code walkthroughs
- Build the SCRIBE agent for onboarding documentation
- Build the RETRIEVER agent for chat Q&A
- Connect walkthrough to graph (step highlighting)

### Tasks

| # | Task | Details | Est. |
|---|------|---------|------|
| **Backend** | | | |
| 3.1 | **NARRATOR agent** | Input: graph JSON + chunks. Use Gemini to generate ordered walkthrough steps. Start from entry points, trace critical paths (BFS from entry nodes). Each step: file, explanation, code snippet, related files. Sequential Gemini calls with 4s delays. | 5h |
| 3.2 | **Walkthrough data model** | `WalkthroughStep(order, title, file_path, explanation, code_snippet, related_files, graph_node_ids, concepts)` | 1h |
| 3.3 | **SCRIBE agent** | Input: graph + chunks + README. Generate 6 Markdown sections: Purpose, Tech Stack, Architecture, Key Files, Data Flow, Setup Guide. One Gemini call per section. | 4h |
| 3.4 | **Onboarding doc model** | `OnboardingDoc(sections: [{title, content, sources}], generated_at, repo_name)` | 1h |
| 3.5 | **RETRIEVER agent** | Embed query with `task_type="RETRIEVAL_QUERY"`. Query ChromaDB (top-K=5). Build context from retrieved chunks. Call Gemini with grounding context + chat history. Return response + citations (file, line numbers). | 4h |
| 3.6 | **Chat history** | In-memory per session. Last 10 messages as context for follow-up questions. Store in SQLite for persistence across sessions. | 2h |
| **Frontend** | | | |
| 3.7 | **Walkthrough panel** | Step-by-step navigation (prev/next). Each step: title, explanation, syntax-highlighted code (`react-syntax-highlighter`). Selecting a step highlights graph nodes. | 5h |
| 3.8 | **Onboarding docs viewer** | Rendered Markdown. Inline editing (textarea toggle). Export as `.md`. Copy to clipboard. | 4h |
| 3.9 | **Chat panel** | Slide-in panel. Message bubbles. Streaming responses via SSE. Citation chips `[src/auth/login.ts:42]` — clickable → opens node in graph. Suggested questions. Loading states. | 5h |
| 3.10 | **Graph ↔ Walkthrough sync** | Selecting a walkthrough step highlights relevant nodes/edges in the graph via `useReactFlow().fitView()`. Panning to center the highlighted nodes. | 3h |

### API Endpoints

```
GET  /api/walkthrough/{job_id}           → { steps: WalkthroughStep[] }
GET  /api/docs/{job_id}                  → { sections, repo_name }
PUT  /api/docs/{job_id}                  → { sections } (save edits)
POST /api/chat/{job_id}                  → { question } → SSE stream { answer, citations }
GET  /api/chat/{job_id}/suggestions      → { questions: string[] }
```

### Deliverables
- ✅ AI-generated walkthrough linked to graph
- ✅ One-click onboarding document generation with editing + export
- ✅ Chat Q&A with citations and source references
- ✅ Walkthrough ↔ graph interactivity

### Suggestions

> **Stream chat responses via SSE** instead of waiting for complete responses. This gives the user instant feedback and feels much snappier.

> **Generate 3-5 "suggested questions" automatically** based on the repo's structure. Examples: "What does {entry_point} do?", "How is authentication handled?", "Explain the data flow". These help users who don't know what to ask.

> **WARNING: Walkthrough generation is the most Gemini-intensive operation.** Trigger it lazily (on-demand when user opens walkthrough tab) rather than during the initial pipeline to avoid rate limit issues.

> **Embedding dimension must match.** Use `output_dimensionality=768` for BOTH document embeddings AND query embeddings. Mismatched dimensions = broken retrieval.

---

## Phase 4 — Polish & Production Readiness (Days 21-26)

### Goals
- Harden error handling and edge cases
- Optimize performance
- Finalize Docker deployment
- UI polish and responsive design

### Tasks

| # | Task | Details | Est. |
|---|------|---------|------|
| **Backend** | | | |
| 4.1 | **Error handling** | Graceful failures per agent. If GRAPHER fails, still show chunks. If Gemini rate-limited, queue and retry. User-facing error messages via SSE. | 4h |
| 4.2 | **Large repo handling** | File count limits (configurable). Progress estimation. Timeout protection (max 5 min per agent). Warn at >200 files. | 3h |
| 4.3 | **Cleanup service** | Delete cloned repos after processing. Configurable TTL for indexed projects. Cron-style cleanup. | 2h |
| 4.4 | **Docker hardening** | Multi-stage builds (Node build → Nginx serve for frontend). Non-root users. Health checks. Volume mounts for ChromaDB persistence. `.dockerignore`. | 3h |
| 4.5 | **API documentation** | OpenAPI schema polish. Example requests/responses. Error code catalog. | 2h |
| **Frontend** | | | |
| 4.6 | **Responsive design** | Mobile-friendly layout. Collapsible panels. Touch gestures for graph. | 4h |
| 4.7 | **Dark mode** | System-preference aware (`prefers-color-scheme`). Manual toggle. Consistent theming across shadcn/ui + React Flow. | 2h |
| 4.8 | **Loading states** | Skeleton loaders for all panels. Optimistic UI where possible. | 2h |
| 4.9 | **Error states** | User-friendly error pages. Retry buttons. Fallback UI when agents fail (partial success indicators). | 2h |
| 4.10 | **Keyboard shortcuts** | `Ctrl+K` search, arrow keys for walkthrough, `Esc` to close panels. | 2h |
| **Testing** | | | |
| 4.11 | **Backend tests** | Unit tests for each agent (with fixture repos). Integration tests for the full pipeline. Rate limiter tests. | 4h |
| 4.12 | **Frontend tests** | Component tests (Vitest + Testing Library). E2E smoke test (Playwright). | 4h |
| **Deployment** | | | |
| 4.13 | **README.md** | Setup guide, screenshots, architecture diagram, contributing guide. | 2h |
| 4.14 | **docker-compose.yml** | Production-ready compose with all services. `docker compose up` works from cold start. Nginx config for SPA routing. | 2h |

### Deliverables
- ✅ Robust error handling — no silent failures
- ✅ `docker compose up` → fully working app from scratch
- ✅ Polished UI with dark mode, loading states, responsive layout
- ✅ Test coverage for critical paths
- ✅ Comprehensive README

---

## Suggestions & Design Decisions

### 1. State Management: Zustand over Redux
**Why:** Solo developer project. Zustand is ~1KB, zero boilerplate, and supports multiple independent stores. Perfect for managing graph state, chat history, and job progress separately.

### 2. Database: SQLite for Metadata (Add to Stack)
**Suggestion:** Add a lightweight SQLite database (via `aiosqlite`) to persist:
- Job history (which repos have been indexed)
- Cached repo hashes → job_id mappings
- Chat history across sessions
- User preferences

ChromaDB handles vectors, but you need structured storage too. SQLite is zero-config and fits the self-hosted philosophy.

### 3. Graph Layout: Dagre + Manual Adjustment
Use `@dagrejs/dagre` for initial hierarchical layout. Users can drag nodes to customize. Save layout positions in localStorage so the graph remembers user arrangements.

### 4. Gemini Prompt Engineering
Create a `prompts/` directory with versioned prompt templates:
- `node_summary.txt` — file summary generation
- `walkthrough.txt` — walkthrough step generation
- `onboarding.txt` — onboarding doc sections
- `chat_system.txt` — chat system prompt with citation instructions

This makes prompts testable and iterable without code changes.

### 5. Monorepo
**Recommendation:** Keep it as a **monorepo** with `frontend/` and `backend/` directories. Easier to manage Docker Compose, shared types, and deployment.

### 6. Gemini SDK
Use `google-genai` (new SDK) not `google-generativeai` (old SDK). The new SDK uses `genai.Client()` pattern and supports both embedding and generation.

### 7. Onboarding Doc Editing: In-Browser (PRD Open Question)
Yes, implement in-browser editing with a simple textarea + markdown preview toggle. Keep it simple for MVP — no WYSIWYG editor needed.

### 8. Walkthrough Reordering: Defer to V2 (PRD Open Question)
Don't allow reordering in MVP. The AI-generated order should be good enough. If users complain, add drag-to-reorder in V2.

### 9. Dense Graph Visualization (PRD Open Question)
For 300+ nodes: implement folder clustering + focus mode. Collapse directories into single nodes by default. Double-click to expand. When clicking any node, dim unrelated nodes.

### 10. `.eihignore` for User-Controlled Filtering
Add support for a `.eihignore` file in repo roots — lets users exclude `tests/`, `migrations/`, `vendor/`, etc. from indexing.

---

## Risk Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Gemini rate limits** | Pipeline stalls | Sequential execution, batching, exponential backoff, caching. Generate walkthrough/docs lazily. |
| **tree-sitter parse failures** | Missing graph nodes | Fallback to regex-based import detection. Log failures, don't crash. |
| **Large repos (1000+ files)** | Memory + time explosion | File count caps (configurable). Folder clustering in UI. Directory-level indexing option. |
| **ChromaDB memory** | OOM on large repos | Run ChromaDB in separate container with memory limits. Use persistent storage. |
| **Mixed-language repos** | Incomplete parsing | Support Python + JS/TS first. Fallback chunking for others. Clearly label unsupported nodes. |
| **Network failures (git clone)** | Ingestion fails | Retry with backoff. Timeout after 120s. Clear error message. |
| **Stale cache** | Outdated results | Cache key = repo URL + latest commit SHA. Option to force re-index. |
| **CPU-bound parsing blocking event loop** | Slow API responses | Use `asyncio.to_thread()` for tree-sitter parsing and GitPython operations. |

---

## Testing Strategy

### Unit Tests (Backend)
- Each agent independently with fixture data
- Rate limiter logic
- Chunk boundary detection
- Import/export parsing accuracy
- Import path resolution (Python and JS/TS)

### Integration Tests (Backend)
- Full pipeline: URL → ChromaDB populated
- SSE event stream correctness
- Chat → retrieval → response flow

### Component Tests (Frontend)
- Graph renders with mock data
- Walkthrough navigation
- Chat message display + citation links

### E2E Tests
- Submit URL → see graph render
- Click node → see details
- Send chat message → get response with citations

### Test Repos
Create 2-3 small fixture repositories (10-20 files each) in different languages for consistent testing.

---

## Timeline Summary

| Phase | Duration | Key Milestone |
|-------|----------|---------------|
| Phase 0 — Scaffolding | Days 1-2 | `docker compose up` works |
| Phase 1 — Foundation | Days 3-8 | Repos ingested + embedded in ChromaDB |
| Phase 2 — Graph | Days 9-14 | Interactive dependency graph in browser |
| Phase 3 — Intelligence | Days 15-20 | Walkthrough + docs + chat working |
| Phase 4 — Polish | Days 21-26 | Production-ready MVP |

**Total estimated time: ~26 working days (5-6 weeks)**

> This is an aggressive but realistic timeline for a solo developer working full-time. Each phase has clear deliverables that can be demo'd independently — **ship each phase as a working increment**.
