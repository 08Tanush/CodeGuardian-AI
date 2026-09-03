"""
utils.py
Small, reusable helper functions shared across the backend services.
Nothing in this file talks to the network or the filesystem in a
surprising way - it's pure helpers only.
"""

import re
import uuid


def new_id() -> str:
    """Generate a short unique id used to key an analysis session."""
    return uuid.uuid4().hex[:12]


def format_bytes(num_bytes: int) -> str:
    """Turn a raw byte count into a human readable string, e.g. '482 KB'."""
    step = 1024.0
    for unit in ["B", "KB", "MB", "GB"]:
        if num_bytes < step:
            return f"{num_bytes:.0f} {unit}" if unit == "B" else f"{num_bytes:.1f} {unit}"
        num_bytes /= step
    return f"{num_bytes:.1f} TB"


def is_probably_binary(sample: bytes) -> bool:
    """Cheap heuristic: if a null byte shows up early, treat the file as binary."""
    return b"\x00" in sample[:1024]


def safe_filename(name: str) -> str:
    """Strip anything that isn't safe to use as part of a path segment."""
    name = name.strip().replace(" ", "_")
    return re.sub(r"[^A-Za-z0-9_.\-]", "", name) or "file"


def clamp(value, low, high):
    """Keep a number inside a [low, high] range."""
    return max(low, min(high, value))


def normalize_github_url(url: str) -> str:
    """
    Accept a few common ways people paste a GitHub URL and normalize them
    down to something GitPython/`git clone` will accept.
    Examples handled:
      - https://github.com/user/repo
      - https://github.com/user/repo/
      - https://github.com/user/repo.git
      - git@github.com:user/repo.git
      - github.com/user/repo
    """
    url = url.strip()
    if url.startswith("git@github.com:"):
        path = url.split("git@github.com:")[1]
        url = f"https://github.com/{path}"
    if not url.startswith("http"):
        url = f"https://{url}"
    url = url.rstrip("/")
    if not url.endswith(".git"):
        url = f"{url}.git"
    return url


def extract_repo_name(url: str) -> str:
    """Pull a friendly repo name out of a GitHub URL for display purposes."""
    cleaned = url.rstrip("/").removesuffix(".git")
    parts = cleaned.split("/")
    if len(parts) >= 2:
        return f"{parts[-2]}/{parts[-1]}"
    return cleaned
