# Engineering Intelligence Hub

**Product Requirements Document — MVP**  
**Version:** 1.0  
**Date:** June 2026  
**Status:** Draft

**Author:** Atharva Dahake (Solo Developer)

**Stack:** React + Vite • FastAPI (Python) • Gemini 2.5 Flash  
**Deployment:** Web App (Self-hostable via Docker)  
**Primary Users:** OSS Contributors • Engineering Teams  
**Scope:** MVP Only — Ship Fast, Learn, Iterate

---

# 1. Overview

Engineering Intelligence Hub (EIH) is a RAG-powered codebase intelligence tool.

It ingests:

- GitHub repositories (public URLs)
- Local project folders
- Markdown and documentation files

It generates three core outputs:

1. Interactive visual dependency graph
2. Guided AI-powered code walkthrough
3. Auto-generated onboarding documentation

The platform serves two audiences equally:

- Open-source contributors trying to understand unfamiliar repositories quickly
- Engineering teams seeking a shared knowledge layer over codebases, documentation, and architecture

---

# 2. Problem Statement

## 2.1 For OSS Contributors

### Challenges

- Reading a large codebase from scratch takes hours.
- README files are often outdated or incomplete.
- No visual map exists showing relationships between files and components.
- First-time contributors spend time exploring the wrong areas of the project.

---

## 2.2 For Engineering Teams

### Challenges

- New hires require weeks to acquire codebase context.
- Senior engineers repeatedly explain the same architecture concepts.
- Incident investigation is slower without searchable architecture knowledge.
- Critical knowledge remains trapped in Slack threads and individuals' heads.

---

# 3. Goals & Non-Goals

## 3.1 MVP Goals

- Accept GitHub repository URLs.
- Accept local folder uploads.
- Accept `.md` and `.txt` documentation.
- Generate an interactive dependency graph.
- Generate AI-driven code walkthroughs.
- Generate onboarding documentation automatically.
- Provide codebase Q&A chat.
- Support self-hosting through Docker Compose.

---

## 3.2 Non-Goals (MVP)

Deferred to V2:

- Private GitHub repository support
- Real-time repository synchronization
- Multi-user authentication
- Team workspaces and RBAC
- IDE plugins
- CLI integrations

Out of scope:

- Images
- Videos
- Spreadsheets
- Non-code assets

---

# 4. User Personas

## Priya — OSS Newcomer

### Profile

- Computer Science student
- Basic React experience
- Interested in open-source contributions

### Pain Point

Large repositories with hundreds of files feel overwhelming.

### Need

> Show me what connects to what and where I should start.

---

## Ravi — Engineering Team Lead

### Profile

- Backend engineer
- Startup team lead
- Regularly onboards new engineers

### Pain Point

Repeatedly explaining architecture and project structure.

### Need

> Generate onboarding material automatically.

---

# 5. Feature Specifications

## 5.1 Input Layer

### GitHub URL Ingestion

- User submits a public GitHub repository URL.
- Repository cloned via HTTPS.
- Maximum repository size: 500 MB.
- Larger repositories trigger warnings and file limits.

---

### Local Folder Upload

- Upload project ZIP file.
- Server extracts ZIP.
- Treated identically to a cloned repository.
- Default upload limit: 100 MB.
- Limit configurable via environment variables.

---

### Documentation Ingestion

Supported formats:

- `.md`
- `.txt`
- `.rst`

Behavior:

- Documents are chunked.
- Embedded alongside source code.

---

## 5.2 Visual Dependency Graph (Priority 1)

### Capabilities

- Interactive force-directed graph.
- Built using React Flow or D3.

### Nodes Represent

- Files
- Components
- Modules

### Edges Represent

- Imports
- Exports
- Function calls

### Node Details

Clicking a node displays:

- File path
- AI-generated summary
- Dependencies
- Dependents

### Interaction

- Zoom
- Pan
- Drag

### Filters

- File type (`.tsx`, `.py`, `.js`)
- Folder/module
- Entry-point depth

### Color Coding

| Type | Color |
|--------|--------|
| Entry Points | Green |
| Components | Blue |
| Services | Orange |
| Utilities | Grey |

### Export Options

- PNG
- SVG

---

## 5.3 Code Walkthrough (Priority 2)

### Features

AI generates a guided repository tour.

Example:

```
Step 1: Entry Point — main.py
Step 2: Authentication Flow
Step 3: Service Layer
```

### Behavior

- Walkthrough linked to graph nodes.
- Selecting a step highlights graph elements.
- Navigate forward and backward.

### Each Step Includes

- File name
- AI explanation
- Syntax-highlighted snippet
- Related files and concepts

---

## 5.4 Onboarding Document Generator (Priority 3)

### One-Click Generation

Sections include:

1. Project Purpose
2. Tech Stack
3. Architecture Overview
4. Key Files & Entry Points
5. Data Flow Summary
6. Local Setup Guide

### Features

- AI-generated content
- Uses source code and documentation
- Inline editing
- Export Markdown
- Copy to clipboard

---

## 5.5 Chat Q&A (Priority 4)

### Features

- Persistent chat panel
- Retrieval-Augmented Generation

### Retrieval

- Top-K = 5 chunks

### Model

- Gemini 2.5 Flash

### Response Requirements

- Source citations
- File paths
- Line references

### Suggested Questions

Examples:

- What does the auth module do?
- Where is the API entry point?
- How does data flow through the application?

---

# 6. Agent Architecture

The backend operates as a multi-agent pipeline.

Each agent owns a single responsibility.

---

## INGESTOR

### Responsibility

- Clone repository
- Extract ZIP
- Walk file tree
- Filter relevant files

### Input

- Repository URL
- ZIP archive
- Documentation files

### Output

- File manifest
- Raw file content

---

## CHUNKER

### Responsibility

- Semantic chunking

### Input

- File manifest

### Output

- Chunk list with metadata

### Chunk Types

- Functions
- Classes
- Documentation sections

---

## EMBEDDER

### Responsibility

- Generate embeddings
- Store vectors

### Input

- Chunk list

### Output

- ChromaDB vector store

---

## GRAPHER

### Responsibility

- Parse imports and exports
- Build dependency graph

### Input

- File manifest

### Output

- Graph JSON

---

## NARRATOR

### Responsibility

- Generate walkthrough

### Input

- Graph JSON
- Chunks

### Output

- Ordered walkthrough steps

---

## SCRIBE

### Responsibility

- Generate onboarding documentation

### Input

- Graph
- Chunks
- README

### Output

- Markdown document

---

## RETRIEVER

### Responsibility

- Handle chat queries

### Input

- User question
- Vector database

### Output

- Grounded response with citations

---

## Orchestration

Managed through:

**JobManager (FastAPI Background Tasks)**

Frontend receives updates via:

- Server-Sent Events (SSE)

---

# 7. Technical Architecture

## 7.1 Technology Stack

| Layer | Technology |
|---------|------------|
| Frontend | React + Vite |
| UI | Tailwind CSS + shadcn/ui |
| Graph | React Flow |
| Backend | FastAPI |
| Vector Store | ChromaDB |
| LLM | Gemini 2.5 Flash |
| Embeddings | Gemini Embedding API |
| Parsing | tree-sitter, ast, acorn |
| Repo Cloning | GitPython |
| Containerization | Docker Compose |

---

## 7.2 Data Flow

### Step 1

User submits:

- GitHub URL
- ZIP upload

INGESTOR starts.

### Step 2

Pipeline executes:

```
CHUNKER
   ↓
EMBEDDER
   ↓
GRAPHER
```

### Step 3

Parallel generation:

```
NARRATOR
SCRIBE
```

### Step 4

Frontend receives graph JSON.

### Step 5

Chat requests use:

```
RETRIEVER
   ↓
Gemini
```

Grounded responses returned with citations.

---

## 7.3 Gemini Rate-Limit Strategy

### Limits

- 15 RPM
- 1M TPM
- 1500 RPD

### Mitigations

- Sequential LLM execution
- Batch embeddings (10 chunks per batch)
- 4-second delay between batches
- Repository hash caching
- Exponential backoff

```
2s → 4s → 8s
```

---

# 8. UI Screens & Layout

## 8.1 Home / Ingestion

### Components

- GitHub URL input
- Drag-and-drop uploader
- Progress bar

### Progress States

```
Ingesting
→ Embedding
→ Graphing
→ Ready
```

### Quick Start Cards

Examples:

- facebook/react
- vercel/next.js

---

## 8.2 Main Workspace

### Left Sidebar

- File tree
- Chat toggle

### Center

- Full-screen dependency graph

### Right Panel

- Node details
- Walkthrough
- Documentation viewer

### Top Bar

- Repository name
- View switcher
- Export controls

---

## 8.3 Graph View

### Features

- Force-directed layout
- Drag
- Zoom
- Pan

### Node Click

Shows:

- AI summary
- Imports
- Exports

### Toolbar

- Language filter
- Depth slider
- Highlight entry points

---

## 8.4 Chat Panel

### Features

- Slide-in interface
- Citation chips

Example:

```
[src/auth/login.ts:42]
```

Clicking a citation opens the relevant file.

---

# 9. MVP Build Phases

| Phase | Goals | Deliverable |
|---------|---------|---------|
| Phase 1 (Foundation) | INGESTOR + CHUNKER + EMBEDDER | Repository indexed in ChromaDB |
| Phase 2 (Graph) | GRAPHER + React Flow UI | Interactive dependency graph |
| Phase 3 (Intelligence) | NARRATOR + SCRIBE | Walkthrough + onboarding docs |
| Phase 4 (Polish) | RETRIEVER + Export + Docker hardening | Production MVP |

---

# 10. Success Metrics

### Performance

- Graph generation under 90 seconds for 50-file repositories.

### Walkthrough Quality

- Covers at least 80% of entry-point files.

### Documentation Quality

- New developers understand architecture without opening source code.

### Chat Quality

- Citations present in at least 90% of responses.

### Deployment

Single command deployment:

```bash
docker compose up
```

---

# 11. Open Questions & Risks

## Technical Risks

### Parsing Accuracy

tree-sitter may struggle with mixed-language repositories.

### Gemini Free Tier Limits

Heavy usage could exceed daily quotas.

### Large Monorepos

Repositories with 1000+ files may exceed ChromaDB memory constraints.

---

## Product Questions

### Documentation Editing

Should onboarding documents be editable in-browser?

### Graph Layout

How should dense graphs (300+ nodes) be visualized?

Potential solution:

- Folder clustering
- Module clustering

### Walkthrough Ordering

Should users be allowed to reorder AI-generated walkthrough steps?

---

# 12. V2 Roadmap

### Repository Support

- Private repositories
- GitHub OAuth
- Personal Access Tokens

### Synchronization

- Webhook-based re-indexing

### Collaboration

- Multi-user authentication
- Team workspaces

### Developer Tooling

- VS Code extension
- Embedded graph panel

### Advanced Visualization

- Commit-to-commit diff visualization
- Branch comparison

### Incident Intelligence

- PDF incident report ingestion
- Link incidents to affected code nodes

---

# Engineering Intelligence Hub

**Build it. Ship it. Understand it.**