"""
file_reader.py
Everything related to walking a repository on disk, deciding which files
are worth analyzing, and reading their content safely.
"""

import os
from pathlib import Path

from services.utils import is_probably_binary

# Folders we never want to walk into - build artifacts, dependency caches,
# and version control internals add noise without adding signal. Pruned
# during the walk itself (not just filtered after) so large repos with
# huge node_modules/vendor trees don't waste time traversing them.
IGNORED_FOLDERS = {
    "node_modules", ".git", "dist", "build", "venv", ".venv",
    "__pycache__", ".next", ".nuxt", ".cache", "coverage", "env",
    ".idea", ".vscode", "target", ".pytest_cache", "vendor",
    "bin", "obj", ".gradle", ".terraform", "site-packages",
}

# File extensions CodeGuardian knows how to reason about.
SUPPORTED_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx",
    ".html", ".css", ".json", ".md",
}

MAX_FILE_BYTES = 200_000   # skip pathologically large single files
MAX_TOTAL_FILES = 1500     # heuristics are cheap, so this can be generous
# Hard cap on how much file content we keep in memory across a whole repo,
# regardless of file count - protects against a repo with many
# medium-sized files still ballooning memory usage.
MAX_TOTAL_CONTENT_BYTES = 30_000_000  # 30 MB


def should_ignore_dir(dirname: str) -> bool:
    return dirname in IGNORED_FOLDERS or dirname.startswith(".")


def walk_repository(root: Path) -> list[Path]:
    """
    Return every supported file under root, skipping ignored folders.
    Uses os.walk with in-place dirname pruning so ignored trees (like a
    huge node_modules) are never descended into at all, rather than being
    walked and filtered out afterward - this matters a lot on large repos.
    """
    collected: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not should_ignore_dir(d)]
        for filename in filenames:
            if Path(filename).suffix.lower() in SUPPORTED_EXTENSIONS:
                collected.append(Path(dirpath) / filename)
                if len(collected) >= MAX_TOTAL_FILES:
                    return collected
    return collected


def read_file_safe(path: Path) -> str | None:
    """Read a file's text content, returning None if it looks binary/unreadable."""
    try:
        if path.stat().st_size > MAX_FILE_BYTES:
            with open(path, "rb") as fh:
                sample = fh.read(1024)
            if is_probably_binary(sample):
                return None
            # Large-but-text file: read a capped amount so context stays small.
            with open(path, "r", encoding="utf-8", errors="ignore") as fh:
                return fh.read(MAX_FILE_BYTES)
        with open(path, "rb") as fh:
            sample = fh.read(1024)
        if is_probably_binary(sample):
            return None
        with open(path, "r", encoding="utf-8", errors="ignore") as fh:
            return fh.read()
    except (OSError, UnicodeDecodeError):
        return None


def build_file_tree(root: Path, files: list[Path]) -> list[dict]:
    """Build a lightweight nested tree structure the frontend can render."""
    tree: dict = {}
    for path in files:
        rel_parts = path.relative_to(root).parts
        node = tree
        for i, part in enumerate(rel_parts):
            is_leaf = i == len(rel_parts) - 1
            if is_leaf:
                node.setdefault("__files__", []).append(part)
            else:
                node = node.setdefault(part, {})

    def to_list(node: dict, path_prefix: str) -> list[dict]:
        result = []
        for key, value in sorted(node.items()):
            if key == "__files__":
                continue
            result.append({
                "type": "folder",
                "name": key,
                "path": f"{path_prefix}{key}",
                "children": to_list(value, f"{path_prefix}{key}/"),
            })
        for filename in sorted(node.get("__files__", [])):
            result.append({
                "type": "file",
                "name": filename,
                "path": f"{path_prefix}{filename}",
            })
        return result

    return to_list(tree, "")


def count_lines(content: str) -> int:
    if not content:
        return 0
    return content.count("\n") + 1
