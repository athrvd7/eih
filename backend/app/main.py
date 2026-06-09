from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import get_settings
from app.services.database import init_db
from app.routers import ingest, jobs, graph, walkthrough, docs, chat

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting EIH backend...")
    await init_db()
    logger.info("Database initialized")
    yield
    logger.info("Shutting down EIH backend...")


app = FastAPI(
    title="Engineering Intelligence Hub API",
    description="RAG-powered codebase intelligence tool",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router, prefix="/api/ingest", tags=["ingest"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(walkthrough.router, prefix="/api/walkthrough", tags=["walkthrough"])
app.include_router(docs.router, prefix="/api/docs", tags=["docs"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "eih-backend"}


@app.get("/")
async def root():
    return {"message": "Engineering Intelligence Hub API", "docs": "/docs"}
