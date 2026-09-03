"""
groq_client.py
Thin wrapper around the Groq chat completion API.

Architecture note: CodeGuardian does NOT send raw source files to Groq for
repository review. All structural/factual analysis (issues, scores, stats,
the dependency graph) is computed locally by the heuristic engine.
Groq's job is to take an already-computed digest of those findings and
turn it into polished prose via one lightweight request per analysis.

Reliability:
- Every AI response is parsed as JSON.
- Repository/file responses are validated against Pydantic schemas.
- One corrective retry is attempted when schema validation fails.
- If Groq is unavailable or the response cannot be validated, the caller
  falls back to deterministic heuristic-only analysis.

Grounding:
The model is explicitly instructed never to invent files, issues,
dependencies, frameworks, or metrics that are not present in the supplied
analysis data.
"""

import json
import logging
import os

from groq import Groq
from pydantic import BaseModel, ValidationError

from services.ai_schemas import FileExplanation, RepositorySummary

logger = logging.getLogger("codeguardian.groq")


# ---------------------------------------------------------------------------
# Groq configuration
# ---------------------------------------------------------------------------

# GPT-OSS 20B is used because CodeGuardian sends compact analysis digests
# rather than raw repository source code.
MODEL = "openai/gpt-oss-20b"

# Increased from 900 to give the model enough room to complete valid JSON.
MAX_TOKENS = 2400

# Timeout for a single Groq request.
REQUEST_TIMEOUT_SECONDS = 30


GROUNDING_RULES = (
    "Ground every statement in ONLY the data provided below. "
    "Never invent files, issues, dependencies, frameworks, or metrics "
    "that are not present in the supplied data. "
    "If the provided data is insufficient to say something specific, "
    "write a general but honest statement instead of making something up. "
    "Static analysis is the source of truth for facts. "
    "Your job is explanation and prioritization, not invention."
)


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class GroqUnavailableError(Exception):
    """
    Raised whenever Groq cannot be used successfully.

    The caller can catch this exception and fall back to the deterministic
    heuristic-only report.
    """


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

def _get_client() -> Groq:
    """
    Create and return a Groq client.

    GROQ_API_KEY is expected to be loaded into the environment by the
    backend startup configuration.
    """
    api_key = os.environ.get("GROQ_API_KEY")

    if not api_key:
        logger.warning(
            "GROQ_API_KEY is not set - falling back to heuristic analysis."
        )
        raise GroqUnavailableError("GROQ_API_KEY is not set")

    return Groq(
        api_key=api_key,
        timeout=REQUEST_TIMEOUT_SECONDS,
    )


# ---------------------------------------------------------------------------
# Generic JSON request
# ---------------------------------------------------------------------------

def ask_json(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = MAX_TOKENS,
    schema: type[BaseModel] | None = None,
) -> dict:
    """
    Send a prompt to Groq and return a JSON object.

    If a Pydantic schema is supplied:
      1. The response is parsed as JSON.
      2. The JSON is validated against the schema.
      3. If validation fails, one corrective retry is attempted.

    Raises:
        GroqUnavailableError:
            If the API key is missing, the request fails, JSON is invalid,
            or schema validation still fails after the retry.
    """

    client = _get_client()

    messages = [
        {
            "role": "system",
            "content": system_prompt,
        },
        {
            "role": "user",
            "content": user_prompt,
        },
    ]

    # We only need a retry when a schema is being validated.
    max_attempts = 2 if schema else 1

    for attempt in range(1, max_attempts + 1):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=messages,

                # GPT-OSS uses completion-token budgeting.
                # 2400 gives enough room for the JSON document to finish.
                max_completion_tokens=max_tokens,

                # Keep the output deterministic and concise.
                temperature=0.3,

                # GPT-OSS supports reasoning effort.
                # Low reasoning is sufficient because the repository analysis
                # has already been performed locally.
                reasoning_effort="low",

                # We don't need the model's internal reasoning returned.
                include_reasoning=False,

                # Require a JSON object from Groq.
                response_format={"type": "json_object"},
            )

            raw = response.choices[0].message.content

            if not raw:
                raise GroqUnavailableError(
                    "Groq returned an empty response"
                )

            data = json.loads(raw)

        except json.JSONDecodeError as exc:
            logger.warning(
                "Groq returned invalid JSON "
                "(attempt %d/%d): %s",
                attempt,
                max_attempts,
                exc,
            )

            if attempt == max_attempts:
                raise GroqUnavailableError(
                    f"Groq returned invalid JSON: {exc}"
                ) from exc

            messages.append(
                {
                    "role": "user",
                    "content": (
                        "Your previous response was not valid JSON. "
                        "Reply again with ONLY one complete valid JSON object. "
                        "Do not include Markdown, explanations, code fences, "
                        "or any text outside the JSON object."
                    ),
                }
            )

            continue

        except GroqUnavailableError:
            raise

        except Exception as exc:
            # This logs the real API/network/auth/rate-limit error.
            logger.exception(
                "Groq request failed: %s",
                exc,
            )

            raise GroqUnavailableError(
                f"Groq request failed: {exc}"
            ) from exc

        # If no schema was supplied, the JSON itself is enough.
        if schema is None:
            return data

        # ---------------------------------------------------------------
        # Pydantic validation
        # ---------------------------------------------------------------

        try:
            validated = schema.model_validate(data)
            return validated.model_dump()

        except ValidationError as exc:
            logger.warning(
                "Groq response failed schema validation "
                "(attempt %d/%d): %s",
                attempt,
                max_attempts,
                exc,
            )

            if attempt == max_attempts:
                raise GroqUnavailableError(
                    f"Groq response failed validation: {exc}"
                ) from exc

            # Give the model the previous answer plus the exact validation
            # error so it can correct the structure.
            messages.append(
                {
                    "role": "assistant",
                    "content": raw,
                }
            )

            messages.append(
                {
                    "role": "user",
                    "content": (
                        "Your previous JSON did not match the required "
                        "schema.\n\n"
                        f"Validation errors:\n{exc}\n\n"
                        "Reply with ONLY a corrected JSON object that "
                        "matches the required schema exactly. "
                        "Do not include Markdown or explanatory text."
                    ),
                }
            )

            continue

    raise GroqUnavailableError(
        "Groq did not return a valid response"
    )


# ---------------------------------------------------------------------------
# File explanation
# ---------------------------------------------------------------------------

def explain_file(filepath: str, content: str) -> dict:
    """
    Ask Groq to explain a single file.

    Only the first 4000 characters are sent because the file explainer
    is intended to provide a concise explanation rather than perform
    another complete static analysis.

    The result is validated against FileExplanation.
    """

    system_prompt = (
        "You are a senior software engineer explaining code to a teammate. "
        f"{GROUNDING_RULES} "

        "Only describe logic, functions, and behavior that actually appears "
        "in the file content given. Never invent code that is not present. "

        "Keep every answer concise so that the complete JSON object can "
        "always be generated within the token limit. "

        "Reply ONLY with one JSON object containing these keys: "
        "purpose (string, non-empty), "
        "logic (string, non-empty), "
        "flow (string, non-empty), "
        "improvements (array of strings), "
        "complexity (exactly one of: 'Low', 'Medium', 'High')."
    )

    user_prompt = (
        f"File: {filepath}\n\n"
        "File content:\n"
        "```\n"
        f"{content[:4000]}"
        "\n```"
    )

    return ask_json(
        system_prompt,
        user_prompt,
        max_tokens=1400,
        schema=FileExplanation,
    )


# ---------------------------------------------------------------------------
# Repository summary
# ---------------------------------------------------------------------------

def summarize_repository(digest_markdown: str) -> dict:
    """
    Generate the AI-powered repository summary.

    CodeGuardian's heuristic engine has already performed the actual
    repository analysis. Groq receives only the compact digest and turns
    those findings into readable prose, suggestions, and a roadmap.

    The result is validated against RepositorySummary.
    """

    system_prompt = (
        "You are CodeGuardian AI. "

        "You will be given a pre-computed static analysis digest of a "
        "software repository. The digest may contain issue counts, top "
        "findings, language breakdown, dependency statistics, and other "
        "analysis results. "

        f"{GROUNDING_RULES} "

        "Do not perform or claim additional analysis that is not supported "
        "by the digest. Do not invent filenames, vulnerabilities, "
        "technologies, metrics, dependencies, or architectural details. "

        "Your response must be concise. Avoid long explanations because "
        "the output must fit into a compact JSON document. "

        "Reply ONLY with one complete JSON object using exactly this shape:\n"

        "{\n"
        '  "summary": "2-4 concise sentences summarizing the repository",\n'
        '  "architecture_overview": "short concise paragraph based only on the digest",\n'
        '  "code_quality_note": "short concise paragraph based only on the digest",\n'
        '  "security_note": "short concise paragraph based only on the digest",\n'
        '  "documentation_note": "short concise paragraph based only on the digest",\n'
        '  "ai_suggestions": ["3-5 short, specific, actionable suggestions"],\n'
        '  "improvement_roadmap": ["3-5 short next steps ordered by priority"]\n'
        "}\n\n"

        "All string fields must be non-empty. "
        "All suggestions and roadmap items must be short. "
        "Return valid JSON only."
    )

    return ask_json(
        system_prompt,
        digest_markdown,
        max_tokens=MAX_TOKENS,
        schema=RepositorySummary,
    )