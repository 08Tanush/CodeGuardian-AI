"""
repo_profile.py
Classifies "what kind of repository is this?" before quality analysis
runs, so the report can talk about a repo in terms that actually make
sense for it - a frontend app shouldn't be described in REST-API terms,
a CLI tool shouldn't be judged on having no web routes, and a
documentation repo shouldn't be penalized for having no backend.

This is a small, deterministic classifier - no AI call, no ML model, no
training data. It uses signals CodeGuardian already computes (detected
frameworks, file extensions, manifest contents, directory structure) and
turns them into one of a handful of well-supported categories. Categories
that can't be reliably distinguished from static signals alone (e.g.
"game" vs "desktop app" vs "browser extension") are deliberately left out
rather than guessed at with low confidence.
"""

FRONTEND_FRAMEWORKS = {"React", "Next.js", "Vue", "Angular"}
BACKEND_FRAMEWORKS = {
    "Express", "FastAPI", "Django", "Flask", "Spring Boot",
    ".NET", "Laravel", "Ruby on Rails",
}

ML_SIGNALS = [
    "torch", "tensorflow", "pytorch", "scikit-learn", "sklearn",
    "keras", "transformers", "xgboost", "lightgbm",
]

CLI_SIGNALS = [
    "console_scripts", "entry_points", "project.scripts",  # setuptools legacy + PEP 621 modern
    "click", "argparse", "typer",
    "commander", "yargs", "cobra",
]

MONOREPO_MARKER_DIRS = {"apps", "packages", "services", "libs"}


def _manifest_haystack(root, manifest_names: list[str], read_file_safe) -> str:
    haystack = ""
    for name in manifest_names:
        manifest = root / name
        if manifest.exists():
            haystack += (read_file_safe(manifest) or "") + "\n"
    return haystack.lower()


def detect_repository_type(
    root,
    files,
    framework: str,
    language_breakdown: dict[str, int],
    files_with_content: list[tuple[str, str]],
    read_file_safe,
) -> dict:
    """
    Returns {"type": str, "evidence": [str, ...]}. `type` is one of:
    frontend_application, backend_application, full_stack_application,
    cli_tool, library, ml_project, documentation, monorepo, unknown.
    """
    detected_frameworks = {f.strip() for f in framework.split(",")} if framework != "Not detected" else set()
    frontend = bool(detected_frameworks & FRONTEND_FRAMEWORKS)
    backend = bool(detected_frameworks & BACKEND_FRAMEWORKS)
    evidence: list[str] = []

    # Monorepo check first - it can contain any of the other types inside
    # it, so it's a structural classification that takes priority.
    top_level_dirs = {p.name for p in root.iterdir() if p.is_dir()} if root.exists() else set()
    monorepo_markers = top_level_dirs & MONOREPO_MARKER_DIRS
    if len(monorepo_markers) >= 2:
        evidence.append(f"Multiple project directories at the repo root: {', '.join(sorted(monorepo_markers))}")
        return {"type": "monorepo", "evidence": evidence}

    manifest_names = ["requirements.txt", "pyproject.toml", "Pipfile", "package.json"]
    manifest_text = _manifest_haystack(root, manifest_names, read_file_safe)

    if any(sig in manifest_text for sig in ML_SIGNALS):
        matched = [s for s in ML_SIGNALS if s in manifest_text]
        evidence.append(f"ML/data-science dependencies found: {', '.join(matched[:3])}")
        return {"type": "ml_project", "evidence": evidence}

    if frontend and backend:
        evidence.append(f"Both a frontend framework ({', '.join(detected_frameworks & FRONTEND_FRAMEWORKS)}) "
                         f"and a backend framework ({', '.join(detected_frameworks & BACKEND_FRAMEWORKS)}) were detected.")
        return {"type": "full_stack_application", "evidence": evidence}

    if frontend:
        evidence.append(f"Frontend framework detected: {', '.join(detected_frameworks & FRONTEND_FRAMEWORKS)}")
        return {"type": "frontend_application", "evidence": evidence}

    if backend:
        evidence.append(f"Backend framework detected: {', '.join(detected_frameworks & BACKEND_FRAMEWORKS)}")
        return {"type": "backend_application", "evidence": evidence}

    # No web framework at all - check CLI signals before falling back to
    # "library", since a CLI is usually also technically installable as a
    # package (the entry_points/console_scripts distinction is what tells
    # them apart, not the presence of a pyproject.toml alone).
    if any(sig in manifest_text for sig in CLI_SIGNALS):
        matched = [s for s in CLI_SIGNALS if s in manifest_text]
        evidence.append(f"CLI entry-point signals found in manifest: {', '.join(matched[:3])}")
        return {"type": "cli_tool", "evidence": evidence}

    # Documentation-only: the vast majority of analyzed files are Markdown
    # and there's essentially no real source code.
    total_analyzed = len(files_with_content)
    md_count = sum(1 for path, _ in files_with_content if path.lower().endswith(".md"))
    source_exts = {".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go", ".rb", ".php", ".cs", ".rs", ".c", ".cpp"}
    source_count = sum(1 for path, _ in files_with_content if "." + path.rsplit(".", 1)[-1].lower() in source_exts)
    if total_analyzed > 0 and md_count / total_analyzed >= 0.7 and source_count <= 2:
        evidence.append(f"{md_count} of {total_analyzed} analyzed files are Markdown, with minimal source code.")
        return {"type": "documentation", "evidence": evidence}

    # A packaging manifest with real source code but no web framework and
    # no CLI entry point is the closest deterministic signal for "library"
    # this classifier can reliably use.
    has_package_manifest = (root / "pyproject.toml").exists() or (root / "setup.py").exists() or (root / "package.json").exists()
    if has_package_manifest and source_count > 0:
        evidence.append("Packaging manifest present with source code but no web framework or CLI entry point detected.")
        return {"type": "library", "evidence": evidence}

    evidence.append("No strong signal for a specific repository type was found.")
    return {"type": "unknown", "evidence": evidence}
