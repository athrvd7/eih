from pydantic import BaseModel
from enum import Enum
from typing import Optional


class ChunkType(str, Enum):
    FUNCTION = "function"
    CLASS = "class"
    METHOD = "method"
    MODULE = "module"
    DOC_SECTION = "doc_section"
    CONFIG = "config"


class Chunk(BaseModel):
    id: str
    file_path: str
    chunk_type: ChunkType
    name: str
    start_line: int
    end_line: int
    content: str
    language: str
    parent_class: Optional[str] = None
    imports: list[str] = []


class ChunkList(BaseModel):
    repo_id: str
    total_chunks: int
    chunks: list[Chunk]
