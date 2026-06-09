# Engineering Intelligence Hub (EIH)

AI-powered codebase intelligence: interactive dependency graphs, guided walkthroughs, onboarding docs, and RAG chat — all from a GitHub URL or ZIP upload.

---

## Quick Start (Local Development)

### Prerequisites
- Python 3.12+
- Node 20+
- Docker (for ChromaDB)

### 1. Start ChromaDB

```bash
docker run -d \
  --name eih-chroma \
  -p 8000:8000 \
  -e IS_PERSISTENT=TRUE \
  -e ANONYMIZED_TELEMETRY=FALSE \
  chromadb/chroma:latest
```

### 2. Set up backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Copy and fill in your Gemini API key
cp .env.example .env             # edit GEMINI_API_KEY=...

# Start backend (port 8001)
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 3. Start frontend

```bash
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

---

## Docker Compose (Full Stack)

```bash
# 1. Set your Gemini API key
echo "GEMINI_API_KEY=your_key_here" > .env

# 2. Start everything
docker compose up --build

# Frontend: http://localhost:5173
# Backend API: http://localhost:8001
# ChromaDB: http://localhost:8000
```

---

## Architecture

```
User Input (GitHub URL / ZIP)
    │
    ▼
INGESTOR → CHUNKER → [EMBEDDER ∥ GRAPHER]
                              │
                    NARRATOR & SCRIBE (lazy)
                              │
                         RETRIEVER (per chat message)
```

| Agent | Role |
|-------|------|
| INGESTOR | Clone repo, walk file tree, produce FileManifest |
| CHUNKER | AST-based code chunking (tree-sitter) |
| EMBEDDER | Gemini embeddings → ChromaDB |
| GRAPHER | Build dependency graph from imports |
| NARRATOR | AI walkthrough (lazy, on-demand) |
| SCRIBE | Onboarding docs generator (lazy) |
| RETRIEVER | RAG chat with citations |

---

## Getting a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Add it to `backend/.env` as `GEMINI_API_KEY=...`

---

## Project Structure

```
eih-project/
├── backend/
│   ├── app/
│   │   ├── agents/       # INGESTOR, CHUNKER, EMBEDDER, GRAPHER, NARRATOR, SCRIBE, RETRIEVER
│   │   ├── models/       # Pydantic data models
│   │   ├── routers/      # FastAPI route handlers
│   │   ├── services/     # SSE, DB, Gemini, ChromaDB
│   │   └── utils/        # File, git, rate-limiting utilities
│   ├── prompts/          # Gemini prompt templates
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/   # Graph, Chat, Walkthrough, Docs UI
│       ├── pages/        # HomePage, WorkspacePage
│       ├── stores/       # Zustand state (job, graph, chat, UI)
│       ├── hooks/        # useSSE
│       ├── lib/          # Graph layout (dagre), utils
│       └── services/     # API client
├── docker-compose.yml
└── .env.example
```
