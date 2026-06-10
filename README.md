# Engineering Intelligence Hub (EIH)

**AI-powered codebase intelligence for faster onboarding, architecture discovery, and grounded code Q&A.**

EIH ingests a GitHub repository, ZIP archive, or documentation bundle, then turns it into an interactive workspace with:

- A visual dependency graph.
- Semantic search over code and docs.
- Lazy AI-generated walkthroughs and onboarding docs.
- Retrieval-augmented chat with source citations.
- Real-time ingestion progress through Server-Sent Events.

**Motto:** Build it. Ship it. Understand it.

Detailed implementation notes are available in [`implementation.md`](implementation.md).

---

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker and Docker Compose
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### 1. Configure environment

```bash
cp .env.example .env
```

Set at least:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

When running with Docker Compose, use:

```env
CHROMA_HOST=chromadb
CHROMA_PORT=8000
```

When running locally without Docker Compose, use:

```env
CHROMA_HOST=localhost
CHROMA_PORT=8000
```

### 2. Start the full stack

```bash
docker compose up --build
```

Open:

- Frontend: http://localhost:5173
- Backend API docs: http://localhost:8001/docs
- ChromaDB: http://localhost:8000

---

## Supported Inputs

### GitHub repositories

Submit a public GitHub URL:

```text
https://github.com/owner/repo
```

### ZIP archives

Upload a `.zip` archive containing a project. Upload size is controlled by `MAX_UPLOAD_MB`.

### Documentation files

Upload one or more of:

- `.md`
- `.txt`
- `.rst`

---

## Core Workflow

1. `INGESTOR` clones, extracts, or collects files and builds a `FileManifest`.
2. `CHUNKER` splits code and docs into searchable chunks.
3. `EMBEDDER` stores embeddings in ChromaDB.
4. `GRAPHER` builds a file-level dependency graph.
5. `NARRATOR` and `SCRIBE` generate walkthroughs and onboarding docs only when requested.
6. `RETRIEVER` answers chat questions using retrieved chunks and citations.

The lazy AI agents help avoid unnecessary Gemini API usage during ingestion.

---

## API Usage

The FastAPI app exposes interactive documentation at:

```text
http://localhost:8001/docs
```

Common endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/ingest/github` | Ingest a public GitHub repository. |
| `POST` | `/api/ingest/upload` | Upload a ZIP archive. |
| `POST` | `/api/ingest/docs` | Upload documentation files. |
| `GET` | `/api/jobs/{job_id}` | Get job status. |
| `GET` | `/api/jobs/{job_id}/events` | Stream ingestion progress via SSE. |
| `GET` | `/api/graph/{job_id}` | Get the dependency graph. |
| `GET` | `/api/graph/{job_id}/node/{encoded_node_id}` | Get graph node details. |
| `GET` | `/api/walkthrough/{job_id}` | Generate or fetch the walkthrough. |
| `GET` | `/api/docs/{job_id}` | Generate or fetch onboarding docs. |
| `PUT` | `/api/docs/{job_id}` | Save edited onboarding docs. |
| `POST` | `/api/chat/{job_id}` | Ask a codebase question. |
| `GET` | `/api/chat/{job_id}/history` | Get chat history. |
| `GET` | `/api/chat/{job_id}/suggestions` | Get suggested follow-up questions. |

---

## Frontend Routes

| Route | Page | Purpose |
|---|---|---|
| `/` | Landing page | Product overview and feature summary. |
| `/analyze` | Ingestion page | Submit GitHub URL, ZIP upload, or docs. |
| `/workspace/:jobId` | Workspace page | Graph explorer, walkthrough, docs, and chat. |

---

## Local Development

### Backend

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

### ChromaDB without Docker Compose

```bash
docker run -d \
  --name eih-chroma \
  -p 8000:8000 \
  -e IS_PERSISTENT=TRUE \
  -e ANONYMIZED_TELEMETRY=FALSE \
  -e CHROMA_SERVER_HOST=0.0.0.0 \
  chromadb/chroma:latest
```

If ChromaDB is unavailable, the backend falls back to an in-memory Chroma client for local development.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Useful frontend scripts:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

---

## Current Limitations

- Private GitHub repositories are not supported.
- GitHub OAuth and personal access tokens are not implemented.
- ZIP upload is the only local project upload format.
- The grapher uses heuristic import resolution and may miss complex import patterns.
- Chat returns JSON rather than streaming token-by-token.
- AI summaries, walkthroughs, and docs depend on Gemini availability and rate limits.
- Repository synchronization, webhooks, multi-user auth, RBAC, and team workspaces are deferred.

---

## Contributing

When working on EIH:

1. Add or update tests for backend agents and routers.
2. Run the frontend build after UI changes.
3. Keep AI features lazy where possible to avoid unnecessary Gemini usage.
4. Prefer graceful degradation over hard failures.
5. Document new environment variables in `.env.example` and `backend/app/config.py`.

---

## License

No license file is included in this repository yet. Add a `LICENSE` file before distributing EIH publicly.
