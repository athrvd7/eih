import asyncio
import hashlib
import logging
import os
import shutil
import zipfile
from pathlib import Path

from app.agents.base import BaseAgent
from app.config import get_settings
from app.models.manifest import FileEntry, FileManifest
from app.utils.file_utils import (
    detect_language,
    parse_eihignore,
    safe_read_file,
    sha256_of_string,
    walk_relevant_files,
)
from app.utils.git_utils import clone_repo, get_repo_name_from_url, validate_github_url

logger = logging.getLogger(__name__)


class Ingestor(BaseAgent):
    """
    INGESTOR agent.

    Accepts three source types:
      - "github" : clone a public GitHub repo (shallow, depth=1)
      - "zip"    : extract a local ZIP archive
      - "docs"   : a list of (filename, content) tuples (already-read docs)

    Returns a FileManifest with all relevant file entries.
    """

    async def execute(self, source_type: str, source) -> FileManifest:
        settings = get_settings()

        if source_type == "github":
            return await self._ingest_github(source, settings)
        elif source_type == "zip":
            return await self._ingest_zip(source, settings)
        elif source_type == "docs":
            return await self._ingest_docs(source)
        else:
            raise ValueError(f"Unknown source_type: {source_type!r}")

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    async def _ingest_github(self, url: str, settings) -> FileManifest:
        if not validate_github_url(url):
            raise ValueError(f"Invalid GitHub URL: {url}")

        await self.report_progress(0.1, f"Cloning {url}...")

        repo_name = await get_repo_name_from_url(url)
        repo_id = sha256_of_string(url)[:16]
        target_dir = os.path.join(settings.repos_dir, repo_id)

        if os.path.exists(target_dir):
            shutil.rmtree(target_dir)
        os.makedirs(settings.repos_dir, exist_ok=True)

        await clone_repo(url, target_dir, depth=1)

        await self.report_progress(0.5, "Walking file tree...")
        return await self._build_manifest(target_dir, repo_id, repo_name)

    async def _ingest_zip(self, zip_path: str, settings) -> FileManifest:
        await self.report_progress(0.1, "Extracting ZIP...")

        repo_id = sha256_of_string(zip_path + str(os.path.getsize(zip_path)))[:16]
        target_dir = os.path.join(settings.repos_dir, repo_id)

        if os.path.exists(target_dir):
            shutil.rmtree(target_dir)
        os.makedirs(target_dir, exist_ok=True)

        def _extract() -> None:
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(target_dir)

        await asyncio.to_thread(_extract)

        # ZIP archives often have a single top-level folder; unwrap it.
        entries = os.listdir(target_dir)
        if len(entries) == 1 and os.path.isdir(os.path.join(target_dir, entries[0])):
            actual_root = os.path.join(target_dir, entries[0])
        else:
            actual_root = target_dir

        repo_name = Path(zip_path).stem  # filename without .zip
        await self.report_progress(0.5, "Walking file tree...")
        return await self._build_manifest(actual_root, repo_id, repo_name)

    async def _ingest_docs(self, files: list[tuple[str, str]]) -> FileManifest:
        """files: list of (filename, content) tuples."""
        await self.report_progress(0.3, "Processing documentation files...")

        repo_id = sha256_of_string(str([(f, c[:64]) for f, c in files]))[:16]
        file_entries: list[FileEntry] = []

        for filename, content in files:
            language = detect_language(filename)
            entry = FileEntry(
                path=filename,
                language=language,
                size_bytes=len(content.encode("utf-8")),
                content=content,
                sha256=sha256_of_string(content),
            )
            file_entries.append(entry)

        return FileManifest(
            repo_id=repo_id,
            repo_name="Documentation",
            total_files=len(file_entries),
            files=file_entries,
            readme_content=None,
        )

    async def _build_manifest(
        self, root_dir: str, repo_id: str, repo_name: str
    ) -> FileManifest:
        eihignore = parse_eihignore(root_dir)

        file_list = await asyncio.to_thread(walk_relevant_files, root_dir, eihignore)

        if not file_list:
            raise ValueError("No relevant source files found in repository")

        await self.report_progress(0.7, f"Reading {len(file_list)} files...")

        file_entries: list[FileEntry] = []
        readme_content: str | None = None

        for i, f in enumerate(file_list):
            content = safe_read_file(f["abs_path"])
            if content is None:
                continue

            entry = FileEntry(
                path=f["path"],
                language=f["language"],
                size_bytes=f["size_bytes"],
                content=content,
                sha256=sha256_of_string(content),
            )
            file_entries.append(entry)

            # Capture README for later use by the Scribe agent
            if f["path"].lower() in ("readme.md", "readme.txt", "readme.rst"):
                readme_content = content

            if i % 20 == 0:
                progress = 0.7 + (0.3 * i / len(file_list))
                await self.report_progress(
                    progress, f"Reading files... ({i}/{len(file_list)})"
                )

        return FileManifest(
            repo_id=repo_id,
            repo_name=repo_name,
            total_files=len(file_entries),
            files=file_entries,
            readme_content=readme_content,
        )
