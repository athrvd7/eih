import hashlib
import os
import shutil
import mimetypes
import fnmatch
from pathlib import Path

ALLOWED_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx",
    ".md", ".txt", ".rst",
    ".json", ".yaml", ".yml", ".toml",
    ".css", ".scss", ".html",
}

IGNORED_DIRS = {
    "node_modules", ".git", "dist", "build", "__pycache__",
    "venv", ".venv", "env", ".next", "vendor", "target",
    ".idea", ".vscode", "coverage", ".pytest_cache",
    "eggs", ".eggs",
}

MAX_FILE_SIZE = 1_000_000  # 1 MB


def sha256_of_string(s: str) -> str:
    """Return SHA-256 hex digest of a UTF-8 string."""
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def sha256_of_file(path: str) -> str:
    """Return SHA-256 hex digest of file contents."""
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def detect_language(path: str) -> str:
    """Map a file extension to a language name."""
    ext = Path(path).suffix.lower()
    mapping = {
        ".py": "python",
        ".ts": "typescript",
        ".tsx": "tsx",
        ".js": "javascript",
        ".jsx": "javascript",
        ".md": "markdown",
        ".yml": "yaml",
        ".yaml": "yaml",
        ".json": "json",
        ".toml": "toml",
    }
    return mapping.get(ext, "text")


def matches_ignore_pattern(rel_path: str, patterns: list[str]) -> bool:
    """Return True if rel_path matches any gitignore-style pattern."""
    for pattern in patterns:
        pattern = pattern.strip()
        if not pattern or pattern.startswith("#"):
            continue
        # Match against the full relative path and just the basename
        if fnmatch.fnmatch(rel_path, pattern):
            return True
        if fnmatch.fnmatch(rel_path.replace(os.sep, "/"), pattern):
            return True
        if fnmatch.fnmatch(os.path.basename(rel_path), pattern):
            return True
    return False


def walk_relevant_files(root_dir: str, eihignore_patterns: list[str] = []) -> list[dict]:
    """
    Walk the directory tree and return metadata for relevant source files.

    Returns a list of dicts:
        {path: relative_path, abs_path: str, language: str, size_bytes: int}
    """
    results = []

    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Prune ignored directories in-place so os.walk won't descend into them
        dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRS]

        for filename in filenames:
            abs_path = os.path.join(dirpath, filename)
            rel_path = os.path.relpath(abs_path, root_dir)

            # Extension filter
            ext = Path(filename).suffix.lower()
            if ext not in ALLOWED_EXTENSIONS:
                continue

            # Size filter
            try:
                size = os.path.getsize(abs_path)
            except OSError:
                continue
            if size > MAX_FILE_SIZE:
                continue

            # .eihignore filter
            if eihignore_patterns and matches_ignore_pattern(rel_path, eihignore_patterns):
                continue

            results.append(
                {
                    "path": rel_path,
                    "abs_path": abs_path,
                    "language": detect_language(filename),
                    "size_bytes": size,
                }
            )

    return results


def safe_read_file(path: str) -> str | None:
    """Read a file as UTF-8 text; return None if it cannot be decoded."""
    try:
        with open(path, "r", encoding="utf-8", errors="strict") as fh:
            return fh.read()
    except (UnicodeDecodeError, OSError):
        return None


def parse_eihignore(root_dir: str) -> list[str]:
    """Read .eihignore from root_dir (if it exists) and return a list of patterns."""
    eihignore_path = os.path.join(root_dir, ".eihignore")
    if not os.path.exists(eihignore_path):
        return []
    patterns = []
    try:
        with open(eihignore_path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line and not line.startswith("#"):
                    patterns.append(line)
    except OSError:
        pass
    return patterns
