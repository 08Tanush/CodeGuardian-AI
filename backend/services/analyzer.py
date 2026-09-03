"""
analyzer.py
The core orchestrator: walks a repository on disk, gathers stats, runs the
heuristic analysis engine (services/heuristics.py) - which is the source
of truth for every issue, score, and stat - then optionally makes ONE
lightweight Groq request to turn a compact digest of those findings into
polished prose (summary, architecture overview, suggestions).

This two-stage design (cheap deterministic analysis first, optional AI
polish second) means:
  - Large repos analyze fast and don't risk hitting Groq's rate limits,
    since raw source code is never sent to the model - only a short digest.
  - If Groq is unavailable, rate-limited, or misconfigured, the report is
    still complete and useful - just with heuristic-generated prose
    instead of AI-polished prose. No data is ever lost to an AI failure.
"""

import logging
from pathlib import Path

from services.path_utils import normalize_path

from services import file_reader, heuristics
from services.dependency_graph import build_dependency_graph
from services.groq_client import GroqUnavailableError, summarize_repository
from services.utils import format_bytes

logger = logging.getLogger("codeguardian.analyzer")

LANGUAGE_BY_EXT = {
    ".py": "Python", ".js": "JavaScript", ".jsx": "JavaScript (React)",
    ".ts": "TypeScript", ".tsx": "TypeScript (React)",
    ".html": "HTML", ".css": "CSS", ".json": "JSON", ".md": "Markdown",
}

FRAMEWORK_SIGNALS = {
    "React": ["\"react\"", "'react'", "react-dom"],
    "Next.js": ["\"next\"", "'next'"],
    "Vue": ["\"vue\"", "'vue'"],
    "Angular": ["@angular/core"],
    "Express": ["\"express\"", "'express'"],
    "FastAPI": ["fastapi"],
    "Django": ["django"],
    "Flask": ["flask"],
}

# Structural signals: presence of a specific file is often a stronger,
# faster hint than parsing manifest contents.
FRAMEWORK_FILE_SIGNALS = {
    "manage.py": "Django",
    "next.config.js": "Next.js",
    "next.config.mjs": "Next.js",
    "angular.json": "Angular",
    "vite.config.js": "Vite",
    "vite.config.ts": "Vite",
    "artisan": "Laravel",
    "Gemfile": "Ruby on Rails",
    "go.mod": "Go",
    "Cargo.toml": "Rust",
    "pom.xml": "Java (Maven)",
    "build.gradle": "Java (Gradle)",
}

# Total file *content* kept in memory across a repo, on top of the
# per-file and file-count caps in file_reader.py - protects against a repo
# with many medium-sized files still ballooning memory usage.
MAX_TOTAL_CONTENT_BYTES = 30_000_000  # 30 MB


def _detect_language_breakdown(files: list[Path]) -> dict[str, int]:
    breakdown: dict[str, int] = {}
    for path in files:
        lang = LANGUAGE_BY_EXT.get(path.suffix.lower())
        if lang:
            breakdown[lang] = breakdown.get(lang, 0) + 1
    return breakdown


def _detect_framework(root: Path, files: list[Path]) -> str:
    detected: set[str] = set()

    manifest_names = ["package.json", "requirements.txt", "pyproject.toml", "Pipfile"]
    haystack = ""
    for name in manifest_names:
        manifest = root / name
        if manifest.exists():
            haystack += (file_reader.read_file_safe(manifest) or "") + "\n"
    haystack_lower = haystack.lower()
    for fw_name, signals in FRAMEWORK_SIGNALS.items():
        if any(sig in haystack_lower for sig in signals):
            detected.add(fw_name)

    top_level_names = {p.name for p in files if len(p.relative_to(root).parts) <= 2}
    for filename, fw_name in FRAMEWORK_FILE_SIGNALS.items():
        if filename in top_level_names:
            detected.add(fw_name)

    if not detected:
        for path in files[:40]:
            content = file_reader.read_file_safe(path) or ""
            lower = content.lower()
            if "from fastapi" in lower or "fastapi(" in lower:
                detected.add("FastAPI")
            elif "from flask" in lower or "flask(__name__)" in lower:
                detected.add("Flask")
            elif "from django" in lower:
                detected.add("Django")
            elif "import react" in lower:
                detected.add("React")
            if detected:
                break

    return ", ".join(sorted(detected)) if detected else "Not detected"


def _top_language(breakdown: dict[str, int]) -> str:
    if not breakdown:
        return "an unknown language"
    return max(breakdown, key=breakdown.get)


def _gather_repo_stats(root: Path) -> dict:
    files = file_reader.walk_repository(root)
    total_size = sum((root / f).stat().st_size for f in files if f.exists())

    files_with_content: list[tuple[str, str]] = []
    total_lines = 0
    content_budget_used = 0
    truncated_for_size = 0

    for path in files:
        if content_budget_used >= MAX_TOTAL_CONTENT_BYTES:
            # Still counted toward file_count/tree/language stats above,
            # just not read into memory for pattern analysis - protects
            # very large repos from ballooning RAM usage.
            truncated_for_size += 1
            continue
        content = file_reader.read_file_safe(path)
        if content is None:
            continue
        rel = normalize_path(str(path.relative_to(root)))
        files_with_content.append((rel, content))
        total_lines += file_reader.count_lines(content)
        content_budget_used += len(content)

    if truncated_for_size:
        logger.info("Skipped reading %d file(s) after hitting the %d MB content cap.",
                    truncated_for_size, MAX_TOTAL_CONTENT_BYTES // 1_000_000)

    return {
        "files": files,
        "files_with_content": files_with_content,
        "file_count": len(files),
        "total_lines": total_lines,
        "total_size": total_size,
        "language_breakdown": _detect_language_breakdown(files),
        "framework": _detect_framework(root, files),
        "truncated_for_size": truncated_for_size,
    }


def _build_digest(repo_meta: dict, issues: list[dict], strengths: list[str], dependency_graph: dict) -> str:
    """
    Compact Markdown summary of everything the heuristic engine found.
    This - NOT raw source code - is what gets sent to Groq. Keeping this
    small is what makes the single AI call per analysis stay cheap even
    on large repositories.
    """
    by_severity = {"high": 0, "medium": 0, "low": 0}
    by_category: dict[str, int] = {}
    for issue in issues:
        by_severity[issue.get("severity", "low")] = by_severity.get(issue.get("severity", "low"), 0) + 1
        cat = issue.get("category", "quality")
        by_category[cat] = by_category.get(cat, 0) + 1

    top_issues = sorted(
        issues, key=lambda i: {"high": 0, "medium": 1, "low": 2}.get(i.get("severity"), 3)
    )[:25]

    lines = [
        f"# Repository: {repo_meta['name']}",
        f"Files analyzed: {repo_meta['file_count']} | Lines: {repo_meta['total_lines']} | "
        f"Size: {repo_meta['total_size_display']} | Primary language: {repo_meta['primary_language']} | "
        f"Framework: {repo_meta['framework']}",
        "",
        f"## Findings ({len(issues)} total: {by_severity['high']} high, "
        f"{by_severity['medium']} medium, {by_severity['low']} low)",
        f"By category: " + ", ".join(f"{k}={v}" for k, v in by_category.items()) or "None",
        "",
        "## Top findings",
    ]
    for issue in top_issues:
        lines.append(f"- [{issue.get('severity', 'low').upper()}] {issue.get('category')}: "
                      f"`{issue.get('file')}` - {issue.get('description')}")
    if not top_issues:
        lines.append("- No issues found.")

    lines += ["", "## Strengths"]
    for s in strengths[:10]:
        lines.append(f"- {s}")
    if not strengths:
        lines.append("- None noted.")

    lines += [
        "",
        f"## Dependency graph: {len(dependency_graph.get('nodes', []))} files, "
        f"{len(dependency_graph.get('edges', []))} import relationships tracked.",
    ]

    return "\n".join(lines)


def _heuristic_prose(repo_meta: dict, issues: list[dict], strengths: list[str], has_readme: bool) -> dict:
    """Plain-language report sections generated without any AI call, used
    both as the full report body when Groq is unavailable and as a
    per-field fallback when an AI response is missing a key."""
    high = sum(1 for i in issues if i["severity"] == "high")
    security_count = sum(1 for i in issues if i["category"] == "security")

    return {
        "summary": (
            f"{repo_meta['name']} contains {repo_meta['file_count']} analyzed files "
            f"({repo_meta['total_size_display']}) written mostly in {repo_meta['primary_language']}. "
            f"Static analysis found {len(issues)} finding(s) across security, quality, and documentation."
        ),
        "architecture_overview": (
            f"Framework detection found: {repo_meta['framework']}. See the architecture map below for "
            "how files import one another, built automatically from static analysis."
        ),
        "code_quality_note": f"Found {sum(1 for i in issues if i['category'] == 'quality')} code quality finding(s) via static analysis.",
        "security_note": f"{security_count} security finding(s), {high} of them high-severity.",
        "documentation_note": "README present." if has_readme else "No README detected at the repo root.",
        "ai_suggestions": [
            "Set GROQ_API_KEY on the backend to unlock AI-polished summaries and suggestions.",
            "Resolve high-severity findings first (see the Security section).",
        ] if not strengths else strengths[:3],
        "improvement_roadmap": [i["description"] for i in sorted(
            issues, key=lambda x: {"high": 0, "medium": 1, "low": 2}.get(x.get("severity"), 3)
        )[:5]] or ["No specific issues found - nice work."],
    }


def analyze_repository(root: Path, name: str) -> dict:
    """
    Main entry point used by the routes. Runs the heuristic engine (always,
    source of truth for structured data) then optionally makes one Groq
    call to polish the prose sections. Returns a full analysis dict ready
    to be JSON-serialized and sent to the frontend / saved as a report.
    """
    stats = _gather_repo_stats(root)
    repo_meta = {
        "name": name,
        "file_count": stats["file_count"],
        "total_lines": stats["total_lines"],
        "total_size": stats["total_size"],
        "total_size_display": format_bytes(stats["total_size"]),
        "language_breakdown": stats["language_breakdown"],
        "primary_language": _top_language(stats["language_breakdown"]),
        "framework": stats["framework"],
    }

    issues, strengths = heuristics.analyze_repository_files(stats["files_with_content"])
    maintainability_score = heuristics.compute_maintainability_score(issues)

    issue_distribution: dict[str, int] = {}
    for issue in issues:
        cat = issue.get("category", "quality")
        issue_distribution[cat] = issue_distribution.get(cat, 0) + 1

    file_tree = file_reader.build_file_tree(root, stats["files"])
    dependency_graph = build_dependency_graph(stats["files_with_content"])

    has_readme = any(p.lower().startswith("readme") for p, _ in stats["files_with_content"])
    heuristic_prose = _heuristic_prose(repo_meta, issues, strengths, has_readme)

    mode = "heuristic"
    prose = heuristic_prose
    try:
        digest = _build_digest(repo_meta, issues, strengths, dependency_graph)
        ai_prose = summarize_repository(digest)
        # Merge - prefer AI prose per field, fall back to heuristic prose
        # for any key the model omitted rather than failing the whole call.
        prose = {key: ai_prose.get(key) or heuristic_prose[key] for key in heuristic_prose}
        mode = "ai"
    except GroqUnavailableError as exc:
        logger.warning("Falling back to heuristic-only prose for '%s': %s", name, exc)

    return {
        "repository": repo_meta,
        "maintainability_score": maintainability_score,
        "summary": prose["summary"],
        "architecture_overview": prose["architecture_overview"],
        "code_quality": prose["code_quality_note"],
        "security_analysis": prose["security_note"],
        "documentation_analysis": prose["documentation_note"],
        "ai_suggestions": prose["ai_suggestions"],
        "improvement_roadmap": prose["improvement_roadmap"],
        "issues": issues,
        "strengths": strengths,
        "issue_distribution": issue_distribution,
        "file_tree": file_tree,
        "dependency_graph": dependency_graph,
        "analysis_mode": mode,
    }
