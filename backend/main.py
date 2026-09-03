"""
main.py
FastAPI application entrypoint for CodeGuardian AI.

Local dev:  uvicorn main:app --reload
Production: uvicorn main:app --host 0.0.0.0 --port $PORT
            (or just `python main.py`, which reads PORT itself - see bottom)
"""

from dotenv import load_dotenv

# Must run before any service module reads os.environ (e.g. GROQ_API_KEY),
# so this import has to stay at the very top of the entrypoint.
load_dotenv()

import logging
import os

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routes import router
from services.session_store import load_all_sessions

logger = logging.getLogger("codeguardian.main")

app = FastAPI(
    title="CodeGuardian AI",
    description="AI-powered engineering intelligence platform for analyzing code repositories.",
    version="1.0.0",
)

# CORS_ORIGINS lets production set the exact deployed frontend domain
# without a code change (e.g. "https://codeguardian.vercel.app"). Falls
# back to the standard local dev ports when unset, so nothing changes for
# local development.
_cors_env = os.environ.get("CORS_ORIGINS", "")
_default_dev_origins = [
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:5173", "http://127.0.0.1:5173",
]
allow_origins = [o.strip() for o in _cors_env.split(",") if o.strip()] or _default_dev_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Last-resort safety net: anything that reaches here is a bug we didn't
    anticipate. The full traceback is logged server-side for debugging,
    but the client only ever sees a clean, generic JSON error - never a
    raw stack trace or internal file paths.
    """
    logger.exception("Unhandled error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on the server. Check the backend logs for details."},
    )


@app.on_event("startup")
def restore_sessions():
    """
    Reloads any analyses saved to disk from a previous run, so a server
    restart (e.g. --reload picking up a code change) doesn't turn every
    open dashboard into a broken link.
    """
    from routes import SESSIONS

    SESSIONS.update(load_all_sessions())
    logger.info("CORS allowed origins: %s", allow_origins)


@app.get("/")
def root():
    return {"message": "CodeGuardian AI backend is running.", "docs": "/docs"}


if __name__ == "__main__":
    # Lets a host that just runs `python main.py` (rather than invoking
    # uvicorn directly with a --port flag) still bind to the
    # platform-provided PORT instead of a hardcoded 8000.
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
