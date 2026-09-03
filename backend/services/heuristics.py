"""
heuristics.py
The primary analysis engine. Every finding here comes from fast,
dependency-free static checks (regex/string matching) - no AI call
required, no rate limits, no token cost. This is the source of truth for
all factual analysis data (issues, scores, stats). Groq is only ever used
afterward, once, to turn an already-computed digest of these findings into
readable prose - never to re-derive the findings themselves.

Being AI-free means this scales to large repositories fine: a few thousand
regex searches over already-read file content is milliseconds of work,
regardless of whether Groq is configured, reachable, or rate-limited.
"""

import re

from services.file_reader import count_lines

# ---------------------------------------------------------------------------
# Security patterns
# ---------------------------------------------------------------------------
_SECRET_ASSIGNMENT_RE = re.compile(
    r"""(?i)\b(api[_-]?key|secret[_-]?key|access[_-]?key|auth[_-]?token|"""
    r"""password|passwd|pwd|private[_-]?key)\s*[:=]\s*['"][^'"\s]{6,}['"]"""
)
_AWS_KEY_RE = re.compile(r"AKIA[0-9A-Z]{16}")
_PRIVATE_KEY_RE = re.compile(r"-----BEGIN (RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----")
_EVAL_EXEC_RE = re.compile(r"\b(eval|exec)\s*\(")
_SHELL_TRUE_RE = re.compile(r"shell\s*=\s*True")
_PICKLE_LOAD_RE = re.compile(r"\bpickle\.(loads?|Unpickler)\b")
_YAML_UNSAFE_RE = re.compile(r"yaml\.load\(\s*[^,)]+\s*\)")
_TLS_VERIFY_FALSE_RE = re.compile(r"verify\s*=\s*False")
_WEAK_HASH_RE = re.compile(r"\b(md5|sha1)\s*\(")
_SQL_CONCAT_RE = re.compile(r"""(?i)\.execute(?:many)?\s*\(\s*(f['"]|['"][^'"]*['"]\s*[%+])""")
_INNERHTML_RE = re.compile(r"\.innerHTML\s*=")
_DOCUMENT_WRITE_RE = re.compile(r"document\.write\s*\(")

# (pattern, severity, human-readable description)
_SECURITY_CHECKS = [
    (_SECRET_ASSIGNMENT_RE, "high", "Possible hard-coded credential or secret."),
    (_AWS_KEY_RE, "high", "Looks like a hard-coded AWS access key ID."),
    (_PRIVATE_KEY_RE, "high", "A private key appears to be committed directly in this file."),
    (_EVAL_EXEC_RE, "medium", "Uses eval()/exec() - can run arbitrary code if the input isn't trusted."),
    (_SHELL_TRUE_RE, "medium", "subprocess call with shell=True - risk of shell injection with untrusted input."),
    (_PICKLE_LOAD_RE, "medium", "Uses pickle to deserialize data - unsafe if the data isn't fully trusted."),
    (_YAML_UNSAFE_RE, "medium", "yaml.load() without a safe Loader can execute arbitrary code."),
    (_TLS_VERIFY_FALSE_RE, "high", "TLS certificate verification is disabled (verify=False)."),
    (_WEAK_HASH_RE, "low", "Uses MD5/SHA1 - weak for password hashing or other security-sensitive use."),
    (_SQL_CONCAT_RE, "high", "Possible SQL injection - query built with string formatting/concatenation."),
    (_INNERHTML_RE, "medium", "Assigns to innerHTML - risk of XSS if the value includes untrusted input."),
    (_DOCUMENT_WRITE_RE, "low", "document.write() is unsafe and blocks page rendering."),
]

# ---------------------------------------------------------------------------
# Quality patterns
# ---------------------------------------------------------------------------
_TODO_RE = re.compile(r"(?i)\b(TODO|FIXME|XXX|HACK)\b")
_PRINT_RE = re.compile(r"(?<!\.)\bprint\s*\(")
_CONSOLE_LOG_RE = re.compile(r"console\.(log|debug)\s*\(")
_BARE_EXCEPT_RE = re.compile(r"^[ \t]*except[ \t]*:[ \t]*$", re.MULTILINE)
_BROAD_EXCEPT_RE = re.compile(r"^[ \t]*except\s+Exception\s*:[ \t]*$", re.MULTILINE)
_PY_DEF_RE = re.compile(r"^[ \t]*def\s+\w+\s*\(", re.MULTILINE)
_PY_DOCSTRING_DEF_RE = re.compile(r'def\s+\w+\s*\([^)]*\)\s*:\s*\n\s*("""|\'\'\')')

LONG_FILE_LINES = 400
LONG_FUNCTION_LINES = 80
DEEP_NESTING_LEVEL = 6


def _max_indent_level(content: str) -> int:
    """Rough estimate of the deepest nesting level in a file, tabs counted as one level."""
    max_level = 0
    for line in content.splitlines():
        stripped = line.lstrip(" \t")
        if not stripped or stripped.startswith(("#", "//", "*")):
            continue
        indent = line[: len(line) - len(stripped)]
        level = indent.count("\t") + (len(indent.replace("\t", "")) // 4)
        max_level = max(max_level, level)
    return max_level


def _count_long_functions(content: str) -> int:
    """
    Rough heuristic: a Python function is "long" if the next top-or-deeper
    `def` doesn't appear within LONG_FUNCTION_LINES lines. Cheap and
    approximate by design - good enough to flag real outliers.
    """
    starts = [content.count("\n", 0, m.start()) for m in _PY_DEF_RE.finditer(content)]
    if not starts:
        return 0
    total_lines = content.count("\n") + 1
    long_count = 0
    for i, start_line in enumerate(starts):
        end_line = starts[i + 1] if i + 1 < len(starts) else total_lines
        if end_line - start_line > LONG_FUNCTION_LINES:
            long_count += 1
    return long_count


def analyze_file(path: str, content: str) -> list[dict]:
    """Run every pattern check against one file's content, return a list of issue dicts."""
    issues: list[dict] = []
    is_py = path.endswith(".py")
    is_js_like = path.endswith((".js", ".jsx", ".ts", ".tsx", ".html"))

    for pattern, severity, description in _SECURITY_CHECKS:
        if pattern.search(content):
            issues.append({"category": "security", "severity": severity, "file": path, "description": description})

    if _TODO_RE.search(content):
        issues.append({"category": "quality", "severity": "low", "file": path,
                        "description": "Contains a TODO/FIXME comment left in the code."})
    if is_py and _PRINT_RE.search(content):
        issues.append({"category": "quality", "severity": "low", "file": path,
                        "description": "Uses print() for output instead of logging."})
    if is_js_like and _CONSOLE_LOG_RE.search(content):
        issues.append({"category": "quality", "severity": "low", "file": path,
                        "description": "Leftover console.log/console.debug statement."})
    if is_py and _BARE_EXCEPT_RE.search(content):
        issues.append({"category": "quality", "severity": "medium", "file": path,
                        "description": "Bare 'except:' silently swallows all errors, including Ctrl+C."})
    elif is_py and _BROAD_EXCEPT_RE.search(content):
        issues.append({"category": "quality", "severity": "low", "file": path,
                        "description": "Broad 'except Exception:' - consider catching more specific errors."})

    line_count = count_lines(content)
    if line_count > LONG_FILE_LINES:
        issues.append({"category": "quality", "severity": "medium", "file": path,
                        "description": f"File is very long ({line_count} lines); consider splitting it up."})

    if is_py:
        long_funcs = _count_long_functions(content)
        if long_funcs:
            issues.append({"category": "quality", "severity": "medium", "file": path,
                            "description": f"{long_funcs} function(s) longer than {LONG_FUNCTION_LINES} lines - consider breaking them up."})

    if _max_indent_level(content) > DEEP_NESTING_LEVEL:
        issues.append({"category": "quality", "severity": "low", "file": path,
                        "description": "Deeply nested code (6+ levels) - harder to read, test, and maintain."})

    if is_py:
        def_count = len(_PY_DEF_RE.findall(content))
        docstring_count = len(_PY_DOCSTRING_DEF_RE.findall(content))
        if def_count >= 4 and (docstring_count / def_count) < 0.25:
            issues.append({"category": "documentation", "severity": "low", "file": path,
                            "description": "Most functions in this file are missing docstrings."})

    return issues


def analyze_repository_files(files_with_content: list[tuple[str, str]]) -> tuple[list[dict], list[str]]:
    """
    Runs every per-file check plus a handful of repo-level checks (README,
    tests) across the whole repository. Returns (issues, strengths).
    """
    issues: list[dict] = []
    strengths: list[str] = []

    for path, content in files_with_content:
        issues.extend(analyze_file(path, content))

    has_readme = any(p.lower().startswith("readme") for p, _ in files_with_content)
    has_tests = any("test" in p.lower() for p, _ in files_with_content)

    if has_readme:
        strengths.append("Repository includes a README for onboarding.")
    else:
        issues.append({"category": "documentation", "severity": "medium", "file": "/",
                        "description": "No README file found at the repository root."})

    if has_tests:
        strengths.append("Repository includes test files.")
    else:
        issues.append({"category": "quality", "severity": "medium", "file": "/",
                        "description": "No test files were detected."})

    if not any(i["category"] == "security" for i in issues):
        strengths.append("No obvious hard-coded secrets or unsafe patterns were detected.")

    return issues, strengths


def compute_maintainability_score(issues: list[dict]) -> int:
    """Deterministic score from issue counts/severity - same inputs always give the same score."""
    high = sum(1 for i in issues if i["severity"] == "high")
    medium = sum(1 for i in issues if i["severity"] == "medium")
    low = sum(1 for i in issues if i["severity"] == "low")
    score = 100 - (high * 12) - (medium * 5) - (low * 1.5)
    return max(10, min(95, round(score)))
