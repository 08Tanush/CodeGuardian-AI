"""
ai_schemas.py
Pydantic schemas that Groq's structured output is validated against.

This is the core of making AI output reliable: instead of trusting
whatever JSON shape Groq happens to return, every AI response is parsed
into one of these models. If it doesn't fit (missing field, wrong type,
an enum value that isn't in the allowed set, an empty required string),
groq_client.ask_json() automatically asks the model to correct itself
once. If it still doesn't validate, the caller gets GroqUnavailableError
and falls back to the deterministic heuristic-only report - the user
never sees malformed AI data.
"""

from pydantic import BaseModel, Field, field_validator


class RepositorySummary(BaseModel):
    summary: str
    architecture_overview: str
    code_quality_note: str
    security_note: str
    documentation_note: str
    ai_suggestions: list[str] = Field(default_factory=list)
    improvement_roadmap: list[str] = Field(default_factory=list)

    @field_validator(
        "summary", "architecture_overview", "code_quality_note",
        "security_note", "documentation_note",
    )
    @classmethod
    def _not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("field must not be empty")
        return v.strip()


class FileExplanation(BaseModel):
    purpose: str
    logic: str
    flow: str
    complexity: str
    improvements: list[str] = Field(default_factory=list)

    @field_validator("purpose", "logic", "flow")
    @classmethod
    def _not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("field must not be empty")
        return v.strip()

    @field_validator("complexity")
    @classmethod
    def _valid_complexity(cls, v: str) -> str:
        allowed = {"Low", "Medium", "High"}
        if v not in allowed:
            raise ValueError(f"complexity must be one of {sorted(allowed)}, got {v!r}")
        return v
