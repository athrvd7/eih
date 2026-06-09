import asyncio
import os
import re
from pathlib import Path

import git


async def clone_repo(url: str, target_dir: str, depth: int = 1) -> str:
    """
    Clone a git repository to target_dir with the given shallow depth.
    Returns the HEAD commit SHA.
    Uses asyncio.to_thread so the blocking git operation doesn't block the event loop.
    """

    def _clone() -> str:
        repo = git.Repo.clone_from(url, target_dir, depth=depth, no_single_branch=True)
        return repo.head.commit.hexsha

    return await asyncio.to_thread(_clone)


async def get_repo_name_from_url(url: str) -> str:
    """
    Extract 'owner/repo' from a GitHub URL.

    Examples:
        https://github.com/owner/repo      -> "owner/repo"
        https://github.com/owner/repo.git  -> "owner/repo"
        https://github.com/owner/repo/     -> "owner/repo"
    """
    url = url.rstrip("/")
    if url.endswith(".git"):
        url = url[:-4]
    parts = url.split("/")
    if len(parts) >= 5:
        # ['https:', '', 'github.com', 'owner', 'repo']
        return f"{parts[-2]}/{parts[-1]}"
    return parts[-1]


def validate_github_url(url: str) -> bool:
    """Return True if the URL looks like https://github.com/owner/repo."""
    pattern = r"^https://github\.com/[\w\-\.]+/[\w\-\.]+/?$"
    return bool(re.match(pattern, url.rstrip("/")))
