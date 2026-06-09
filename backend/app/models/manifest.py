from pydantic import BaseModel
from typing import Optional


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
    readme_content: Optional[str] = None
