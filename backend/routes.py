"""
routes.py
All HTTP endpoints for CodeGuardian AI. Kept intentionally flat and
readable - each endpoint does validation, delegates to a service module,
and returns a plain JSON-serializable dict.
"""

import logging
import re
import shutil
import tempfile
import time
import zipfile
from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from services import github as github_service
from services.analyzer import analyze_repository
from services.file_reader import count_lines, read_file_safe
from services.groq_client import GroqUnavailableError, explain_file
from services.report_generator import build_markdown_report
from services.session_store import persist_session
from services.utils import new_id, safe_filename

logger = logging.getLogger("codeguardian.routes")
router = APIRouter(prefix="/api")

# Cloned/extracted repos and session data live in the OS temp directory,
# deliberately OUTSIDE the backend/ source folder. `uvicorn --reload`
# recursively watches the directory it's run from for .py changes - if
# analyzed repos were stored inside backend/, cloning/extracting a Python
# project would trigger a reload mid-analysis and kill the request. Using
# the system temp dir sidesteps that regardless of how uvicorn is invoked.
DATA_DIR = Path(tempfile.gettempdir()) / "codeguardian_ai_data"
TEMP_DIR = DATA_DIR / "temp"
UPLOADS_DIR = DATA_DIR / "uploads"

# In-memory session store: analysis id -> { analysis, repo_path, name }
# No database per the project spec - this is intentionally simple and
# lives only as long as the server process does.
SESSIONS: dict[str, dict] = {}

# --- Upload hardening ---
MAX_UPLOAD_BYTES = 50 * 1024 * 1024        # 50 MB, matches the frontend's own check
MAX_ZIP_UNCOMPRESSED_BYTES = 500 * 1024 * 1024  # reject zip bombs before extracting
MAX_ZIP_ENTRIES = 20_000                    # reject zips with an absurd number of tiny files

# --- Simple in-memory rate limiting for the two analysis-triggering
# endpoints, so one client can't hammer the server (and burn through the
# Groq quota / CPU time) with rapid repeated uploads. Intentionally basic
# - a sliding window per client IP, no external dependency needed.
RATE_LIMIT_WINDOW_SECONDS = 300
RATE_LIMIT_MAX_REQUESTS = 8
_rate_limit_hits: dict[str, list[float]] = {}


def _enforce_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    hits = [t for t in _rate_limit_hits.get(client_ip, []) if now - t < RATE_LIMIT_WINDOW_SECONDS]
    if len(hits) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=429,
            detail="Too many analysis requests from this client - please wait a few minutes and try again.",
        )
    hits.append(now)
    _rate_limit_hits[client_ip] = hits


class GithubUrlRequest(BaseModel):
    url: str = Field(..., min_length=8, description="Public GitHub repository URL")


class FileExplainRequest(BaseModel):
    id: str
    path: str


def _is_github_url(url: str) -> bool:
    """
    Strictly validates that a URL's actual host is github.com/www.github.com -
    NOT a substring check. A substring check (`"github.com" in url`) can be
    bypassed by a URL like `https://evil.com/?x=github.com/user/repo`, which
    would reach `git clone` against an attacker-controlled host. Parsing the
    URL and checking the real hostname closes that gap.
    """
    candidate = url if "://" in url else f"https://{url}"
    try:
        host = urlparse(candidate).hostname or ""
    except ValueError:
        return False
    return host.lower() in ("github.com", "www.github.com")


def _store_session(session_id: str, repo_path: Path, name: str, analysis: dict) -> None:
    SESSIONS[session_id] = {"repo_path": repo_path, "name": name, "analysis": analysis, "repo_available": True}
    persist_session(session_id, repo_path, name, analysis)


def _get_session_or_404(session_id: str) -> dict:
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Analysis not found. It may have expired.")
    return session


@router.get("/health")
def health_check():
    return {"status": "ok"}


def _validate_zip_is_safe(zip_path: Path) -> None:
    """
    Defense-in-depth checks before extracting an uploaded zip:
      - total uncompressed size stays under a sane cap (zip bomb protection)
      - entry count stays under a sane cap (many-tiny-files zip bomb variant)
      - no entry resolves outside the intended extraction directory (zip slip)
    Raises HTTPException with a friendly message if anything looks wrong.
    """
    with zipfile.ZipFile(zip_path, "r") as zf:
        infos = zf.infolist()
        if len(infos) > MAX_ZIP_ENTRIES:
            raise HTTPException(status_code=400, detail="This zip contains too many files to analyze safely.")

        total_uncompressed = sum(info.file_size for info in infos)
        if total_uncompressed > MAX_ZIP_UNCOMPRESSED_BYTES:
            raise HTTPException(status_code=400, detail="This zip is too large once decompressed (possible zip bomb).")

        for info in infos:
            # Reject absolute paths and any ".." traversal segments outright.
            if info.filename.startswith("/") or info.filename.startswith("\\") or ".." in Path(info.filename).parts:
                raise HTTPException(status_code=400, detail="This zip contains an unsafe file path and was rejected.")


@router.post("/upload/zip")
async def upload_zip(request: Request, file: UploadFile = File(...)):
    _enforce_rate_limit(request)

    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a .zip file.")

    session_id = new_id()
    zip_path = UPLOADS_DIR / f"{session_id}.zip"
    extract_dir = TEMP_DIR / session_id

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")
        if len(contents) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=400, detail=f"File is larger than the {MAX_UPLOAD_BYTES // (1024*1024)}MB limit.")
        zip_path.write_bytes(contents)

        try:
            _validate_zip_is_safe(zip_path)
            with zipfile.ZipFile(zip_path, "r") as zf:
                bad_file = zf.testzip()
                if bad_file:
                    raise HTTPException(status_code=400, detail=f"Corrupt file inside zip: {bad_file}")
                extract_dir.mkdir(parents=True, exist_ok=True)
                zf.extractall(extract_dir)
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="That doesn't look like a valid ZIP file.")

        # If the zip contains a single top-level folder, treat that as the root
        # so the file tree doesn't have a redundant extra layer.
        entries = [p for p in extract_dir.iterdir()]
        root = entries[0] if len(entries) == 1 and entries[0].is_dir() else extract_dir

        if not any(root.rglob("*")):
            raise HTTPException(status_code=400, detail="The repository appears to be empty.")

        repo_name = safe_filename(Path(file.filename).stem)
        analysis = analyze_repository(root, repo_name)
        _store_session(session_id, root, repo_name, analysis)

        return {"id": session_id, "analysis": analysis}

    except HTTPException:
        shutil.rmtree(extract_dir, ignore_errors=True)
        zip_path.unlink(missing_ok=True)
        raise
    except Exception as exc:
        shutil.rmtree(extract_dir, ignore_errors=True)
        zip_path.unlink(missing_ok=True)
        logger.exception("Zip analysis failed for session %s: %s", session_id, exc)
        raise HTTPException(status_code=500, detail="Analysis failed unexpectedly. Please try again.") from exc


@router.post("/upload/github")
def upload_github(payload: GithubUrlRequest, request: Request):
    _enforce_rate_limit(request)

    url = payload.url.strip()
    if not _is_github_url(url):
        raise HTTPException(status_code=400, detail="Please provide a valid public GitHub repository URL.")

    session_id = new_id()
    clone_dir = TEMP_DIR / session_id

    try:
        root, repo_name = github_service.clone_repository(url, clone_dir)

        if not any(root.rglob("*")):
            raise HTTPException(status_code=400, detail="That repository appears to be empty.")

        analysis = analyze_repository(root, repo_name)
        _store_session(session_id, root, repo_name, analysis)

        return {"id": session_id, "analysis": analysis}

    except github_service.InvalidGithubUrlError as exc:
        shutil.rmtree(clone_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except github_service.CloneFailedError as exc:
        shutil.rmtree(clone_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except github_service.RepositoryTooLargeError as exc:
        shutil.rmtree(clone_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        shutil.rmtree(clone_dir, ignore_errors=True)
        raise
    except Exception as exc:
        shutil.rmtree(clone_dir, ignore_errors=True)
        logger.exception("GitHub analysis failed for session %s: %s", session_id, exc)
        raise HTTPException(status_code=500, detail="Analysis failed unexpectedly. Please try again.") from exc


@router.get("/analysis/{session_id}")
def get_analysis(session_id: str):
    session = _get_session_or_404(session_id)
    return {"id": session_id, "analysis": session["analysis"]}


@router.post("/file/explain")
def explain_file_endpoint(payload: FileExplainRequest):
    session = _get_session_or_404(payload.id)
    if not session.get("repo_available", True):
        raise HTTPException(
            status_code=410,
            detail="This repository's files are no longer available on the server "
                   "(likely cleared after a restart). Re-upload to browse files again.",
        )
    repo_path: Path = session["repo_path"]

    # Prevent path traversal outside of the analyzed repo.
    target = (repo_path / payload.path).resolve()
    if repo_path.resolve() not in target.parents and target != repo_path.resolve():
        raise HTTPException(status_code=400, detail="Invalid file path.")
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found in this repository.")

    content = read_file_safe(target)
    if content is None:
        raise HTTPException(status_code=400, detail="That file can't be read as text (binary or too large).")

    try:
        explanation = explain_file(payload.path, content)
        explanation["source"] = "ai"
        return explanation
    except GroqUnavailableError:
        return _heuristic_file_explanation(payload.path, content)


def _heuristic_file_explanation(path: str, content: str) -> dict:
    """Fallback explanation used when Groq isn't configured/reachable."""
    lines = count_lines(content)
    functions = len(re.findall(r"^\s*(def |function |const \w+\s*=\s*\(|export function)", content, re.MULTILINE))
    complexity = "Low" if lines < 80 else "Medium" if lines < 250 else "High"
    return {
        "purpose": f"'{path}' is part of the repository (heuristic explanation - AI analysis not configured).",
        "logic": f"Contains roughly {functions} function/method definition(s) across {lines} lines.",
        "flow": "Enable AI analysis (set GROQ_API_KEY) for a detailed control-flow explanation.",
        "improvements": ["Enable AI analysis for tailored improvement suggestions."],
        "complexity": complexity,
        "source": "heuristic",
    }


@router.get("/report/{session_id}/download", response_class=PlainTextResponse)
def download_report(session_id: str):
    session = _get_session_or_404(session_id)
    markdown = build_markdown_report(session["analysis"])
    filename = safe_filename(f"{session['name']}-codeguardian-report.md")

    return PlainTextResponse(
        content=markdown,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
