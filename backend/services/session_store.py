"""
session_store.py
CodeGuardian has no database - analysis sessions normally just live in an
in-memory dict. That's fine until the server restarts (e.g. `--reload`
picking up a code change) and every open dashboard/report link suddenly
404s with "Analysis not found".

This module persists each session's analysis result (and the path to its
extracted/cloned repo) as a small JSON file, and reloads them all back into
memory on startup - so links keep working across restarts as long as the
underlying temp folder for that repo hasn't been cleaned up.
"""

import json
import tempfile
from pathlib import Path

# Kept outside backend/ (in the OS temp dir) for the same reason as
# routes.py's DATA_DIR - so uvicorn --reload's file watcher never sees
# these files change and restarts don't get triggered mid-request.
SESSIONS_DIR = Path(tempfile.gettempdir()) / "codeguardian_ai_data" / "sessions"


def _session_file(session_id: str) -> Path:
    return SESSIONS_DIR / f"{session_id}.json"


def persist_session(session_id: str, repo_path: Path, name: str, analysis: dict) -> None:
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "repo_path": str(repo_path),
        "name": name,
        "analysis": analysis,
    }
    _session_file(session_id).write_text(json.dumps(payload), encoding="utf-8")


def load_all_sessions() -> dict[str, dict]:
    """Read every persisted session back into the shape routes.py expects."""
    restored: dict[str, dict] = {}
    if not SESSIONS_DIR.exists():
        return restored

    for file in SESSIONS_DIR.glob("*.json"):
        try:
            payload = json.loads(file.read_text(encoding="utf-8"))
            repo_path = Path(payload["repo_path"])
            restored[file.stem] = {
                "repo_path": repo_path,
                "name": payload["name"],
                "analysis": payload["analysis"],
                # If the temp folder itself is gone, the analysis/report can
                # still be viewed, but the file explainer can't read files.
                "repo_available": repo_path.exists(),
            }
        except (json.JSONDecodeError, KeyError, OSError):
            continue

    return restored
