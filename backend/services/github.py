"""
github.py
Handles cloning a public GitHub repository to a temp folder so the
analyzer can walk it like any other extracted upload.
"""

import os
import shutil
from pathlib import Path
from urllib.parse import urlparse

from git import GitCommandError, Repo

from services.utils import extract_repo_name, normalize_github_url

# Guards against someone pointing this at an enormous public repo and
# tying up the server (or filling the disk) for the duration of a clone.
MAX_CLONE_BYTES = 500 * 1024 * 1024  # 500 MB


class InvalidGithubUrlError(Exception):
    pass


class CloneFailedError(Exception):
    pass


class RepositoryTooLargeError(Exception):
    pass


def _dir_size(path: Path) -> int:
    total = 0
    for entry in path.rglob("*"):
        if entry.is_file():
            try:
                total += entry.stat().st_size
            except OSError:
                continue
    return total


def clone_repository(url: str, dest_dir: Path) -> tuple[Path, str]:
    """
    Shallow-clone a public GitHub repo into dest_dir.
    Returns (path_to_clone, friendly_repo_name).
    """
    # Defense-in-depth: routes.py already validates this, but a strict host
    # check (not a substring match) is cheap insurance against ever cloning
    # from an attacker-controlled host if this function is called directly.
    candidate = url if "://" in url else f"https://{url}"
    host = (urlparse(candidate).hostname or "").lower()
    if host not in ("github.com", "www.github.com"):
        raise InvalidGithubUrlError("Only public GitHub repository URLs are supported.")

    normalized = normalize_github_url(url)
    dest_dir.mkdir(parents=True, exist_ok=True)

    # GIT_TERMINAL_PROMPT=0 stops git from hanging the request waiting for
    # a username/password prompt on a private or nonexistent repo - it
    # fails fast with a GitCommandError instead, which we turn into a
    # friendly message below.
    clone_env = {**os.environ, "GIT_TERMINAL_PROMPT": "0"}

    try:
        Repo.clone_from(normalized, dest_dir, depth=1, single_branch=True, env=clone_env)
    except GitCommandError as exc:
        shutil.rmtree(dest_dir, ignore_errors=True)
        raise CloneFailedError(
            "Couldn't clone that repository. Double check the URL is a public GitHub repo."
        ) from exc

    size = _dir_size(dest_dir)
    if size > MAX_CLONE_BYTES:
        shutil.rmtree(dest_dir, ignore_errors=True)
        raise RepositoryTooLargeError(
            f"That repository is too large to analyze in this demo "
            f"({size // (1024*1024)}MB, limit {MAX_CLONE_BYTES // (1024*1024)}MB)."
        )

    return dest_dir, extract_repo_name(normalized)
