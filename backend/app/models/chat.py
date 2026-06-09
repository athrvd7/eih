from pydantic import BaseModel


class Citation(BaseModel):
    file_path: str
    start_line: int
    end_line: int
    snippet: str
    chunk_name: str


class ChatMessage(BaseModel):
    role: str
    content: str
    citations: list[Citation] = []
    timestamp: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    suggested_followups: list[str] = []
