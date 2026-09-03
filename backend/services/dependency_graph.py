"""
dependency_graph.py
Builds a lightweight "which file imports which file" graph purely with
regex/static parsing - no AI call needed, so the architecture map always
works even in heuristic mode. Supports Python (absolute + relative,
src-layout aware) and JS/TS/JSX/TSX imports, including tsconfig.json /
jsconfig.json path aliases (e.g. "@/*" -> "src/*").

Every import is classified as resolved, unresolved, or external - never
silently dropped. "External" means a bare package import (react, lodash,
requests) that isn't expected to resolve to a file in this repo. "Unresolved"
means an import that SHOULD resolve within the repo (a relative import, or
one matching a known alias) but the target file couldn't be found - this is
surfaced as a diagnostic, not hidden.
"""

import json as jsonlib
import re
from pathlib import PurePosixPath

PY_IMPORT_RE = re.compile(
    r"^\s*(?:from\s+([.\w]+)\s+import|import\s+([.\w]+))", re.MULTILINE
)
JS_IMPORT_RE = re.compile(
    r"""(?:import\s.*?from\s*|import\(|require\()\s*['"]([^'"]+)['"]"""
)

MAX_NODES = 120  # keep the graph readable and the payload small
MAX_UNRESOLVED_REPORTED = 30  # cap the diagnostics payload size
MAX_CYCLES_REPORTED = 20


def _folder_of(path: str) -> str:
    parts = path.split("/")
    return parts[0] if len(parts) > 1 else "root"


def _load_path_aliases(files_with_content: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """
    Parses tsconfig.json/jsconfig.json compilerOptions.paths into a list of
    (alias_prefix, target_prefix) pairs, e.g. ("@/", "src/"). Tolerant of
    trailing commas and `//` comments, since real-world tsconfig.json files
    almost always contain both despite technically being invalid JSON.
    """
    aliases: list[tuple[str, str]] = []
    for path, content in files_with_content:
        if path not in ("tsconfig.json", "jsconfig.json"):
            continue
        try:
            cleaned = re.sub(r"//.*", "", content)
            cleaned = re.sub(r",(\s*[}\]])", r"\1", cleaned)
            data = jsonlib.loads(cleaned)
        except (ValueError, TypeError):
            continue

        compiler_options = data.get("compilerOptions", {}) if isinstance(data, dict) else {}
        if not isinstance(compiler_options, dict):
            continue
        base_url = compiler_options.get("baseUrl", ".")
        paths = compiler_options.get("paths", {})
        if not isinstance(paths, dict):
            continue

        for alias, targets in paths.items():
            if not isinstance(targets, list) or not targets or not isinstance(targets[0], str):
                continue
            alias_prefix = alias.rstrip("*")
            target_prefix = targets[0].rstrip("*")
            combined = str(PurePosixPath(base_url) / target_prefix) if base_url not in (".", "") else target_prefix
            combined = combined.strip("/")
            aliases.append((alias_prefix, f"{combined}/" if combined else ""))

    return aliases


def _resolve_py_module(module: str, importer_dir: PurePosixPath, all_paths: set[str]) -> str | None:
    """Turn a Python dotted module path into a repo-relative file path, if it exists in the repo."""
    if not module:
        return None
    if module.startswith("."):
        dots = len(module) - len(module.lstrip("."))
        remainder = module.lstrip(".")
        base = importer_dir
        for _ in range(dots - 1):
            base = base.parent
        candidate_parts = remainder.split(".") if remainder else []
        candidate = base.joinpath(*candidate_parts) if candidate_parts else base
        for suffix in (".py", "/__init__.py"):
            guess = f"{candidate}{suffix}"
            if guess in all_paths:
                return guess
        return None

    # Absolute import: try from the repo root first, then from common
    # source-layout roots (src/, app/, etc.) since "from mypkg import x"
    # in a src-layout repo actually lives at src/mypkg/x.py.
    module_parts = module.split(".")
    candidates = [PurePosixPath(*module_parts)]
    source_roots = {PurePosixPath(p).parts[0] for p in all_paths if "/" in p}
    for root_name in source_roots:
        candidates.append(PurePosixPath(root_name, *module_parts))

    for candidate in candidates:
        for suffix in (".py", "/__init__.py"):
            guess = f"{candidate}{suffix}"
            if guess in all_paths:
                return guess
    return None


def _resolve_js_import(
    spec: str, importer_dir: PurePosixPath, all_paths: set[str], aliases: list[tuple[str, str]]
) -> tuple[str | None, str]:
    """
    Resolve a JS/TS import spec. Returns (target_path_or_None, status), where
    status is one of "resolved", "unresolved", or "external".
    """
    if spec.startswith("."):
        candidate = str(PurePosixPath((importer_dir / spec).as_posix()))
    else:
        matched_prefix = None
        for alias_prefix, target_prefix in aliases:
            if spec.startswith(alias_prefix):
                matched_prefix = target_prefix + spec[len(alias_prefix):]
                break
        if matched_prefix is None:
            return None, "external"  # bare package import (react, lodash, ...), not ours to resolve
        candidate = matched_prefix

    for suffix in ("", ".js", ".jsx", ".ts", ".tsx", "/index.js", "/index.jsx", "/index.ts", "/index.tsx"):
        guess = f"{candidate}{suffix}"
        if guess in all_paths:
            return guess, "resolved"
    return None, "unresolved"


def _find_cycles(node_ids: list[str], edges: list[dict]) -> list[list[str]]:
    """
    DFS-based cycle detection (white/gray/black coloring) over the final,
    already-trimmed graph. Capped so a dense graph can't cause runaway
    recursion or an enormous diagnostics payload.
    """
    adjacency: dict[str, list[str]] = {n: [] for n in node_ids}
    for e in edges:
        if e["source"] in adjacency:
            adjacency[e["source"]].append(e["target"])

    WHITE, GRAY, BLACK = 0, 1, 2
    color = {n: WHITE for n in node_ids}
    cycles: list[list[str]] = []

    def dfs(node: str, path: list[str]):
        if len(cycles) >= MAX_CYCLES_REPORTED:
            return
        color[node] = GRAY
        path.append(node)
        for neighbor in adjacency.get(node, []):
            if len(cycles) >= MAX_CYCLES_REPORTED:
                break
            if color.get(neighbor) == GRAY and neighbor in path:
                idx = path.index(neighbor)
                cycles.append(path[idx:])
            elif color.get(neighbor) == WHITE:
                dfs(neighbor, path)
        path.pop()
        color[node] = BLACK

    for n in node_ids:
        if color[n] == WHITE:
            dfs(n, [])
    return cycles


def build_dependency_graph(files_with_content: list[tuple[str, str]]) -> dict:
    """
    Returns:
    {
      "nodes": [{id, label, folder, language}],
      "edges": [{source, target}],
      "cycles": [[file, file, ...], ...],
      "diagnostics": {
        "resolvedCount": int, "unresolvedCount": int, "externalCount": int,
        "totalCandidateFiles": int, "shownFiles": int, "truncated": bool,
      },
      "unresolved": [{"source": ..., "specifier": ..., "reason": ...}, ...]
    }

    Edges are computed across ALL candidate files first, then - only if the
    repo has more files than MAX_NODES - the graph is trimmed down to the
    most-connected files (highest degree), not an arbitrary prefix of the
    file list. Truncating before computing edges would silently produce a
    graph of whichever 120 files happened to come first in directory
    traversal order, which is usually meaningless.
    """
    all_paths = {path for path, _ in files_with_content}
    aliases = _load_path_aliases(files_with_content)

    relevant = [(p, c) for p, c in files_with_content if p.endswith((".py", ".js", ".jsx", ".ts", ".tsx"))]
    relevant_paths = {p for p, _ in relevant}

    edges = []
    seen_edges = set()
    unresolved: list[dict] = []
    resolved_count = 0
    unresolved_count = 0
    external_count = 0

    for path, content in relevant:
        importer_dir = PurePosixPath(path).parent

        if path.endswith(".py"):
            for match in PY_IMPORT_RE.finditer(content):
                module = match.group(1) or match.group(2)
                target = _resolve_py_module(module, importer_dir, all_paths)
                if target and target in relevant_paths:
                    resolved_count += 1
                    if target != path:
                        key = (path, target)
                        if key not in seen_edges:
                            seen_edges.add(key)
                            edges.append({"source": path, "target": target})
                elif module.startswith("."):
                    # Only flag relative imports as unresolved - absolute
                    # imports are ambiguous (stdlib/pip package vs local
                    # module) and would produce noisy false positives.
                    unresolved_count += 1
                    if len(unresolved) < MAX_UNRESOLVED_REPORTED:
                        unresolved.append({"source": path, "specifier": module, "reason": "target_not_found"})
                else:
                    external_count += 1
        else:  # js/jsx/ts/tsx
            for match in JS_IMPORT_RE.finditer(content):
                target, status = _resolve_js_import(match.group(1), importer_dir, all_paths, aliases)
                if status == "resolved" and target in relevant_paths:
                    resolved_count += 1
                    if target != path:
                        key = (path, target)
                        if key not in seen_edges:
                            seen_edges.add(key)
                            edges.append({"source": path, "target": target})
                elif status == "unresolved":
                    unresolved_count += 1
                    if len(unresolved) < MAX_UNRESOLVED_REPORTED:
                        reason = "alias_target_not_found" if not match.group(1).startswith(".") else "target_not_found"
                        unresolved.append({"source": path, "specifier": match.group(1), "reason": reason})
                else:
                    external_count += 1

    total_candidate_files = len(relevant)
    kept_paths = relevant_paths
    truncated = False
    if len(relevant) > MAX_NODES:
        truncated = True
        degree: dict[str, int] = {}
        for e in edges:
            degree[e["source"]] = degree.get(e["source"], 0) + 1
            degree[e["target"]] = degree.get(e["target"], 0) + 1
        ranked = sorted(relevant_paths, key=lambda p: degree.get(p, 0), reverse=True)
        kept_paths = set(ranked[:MAX_NODES])
        edges = [e for e in edges if e["source"] in kept_paths and e["target"] in kept_paths]

    nodes = [
        {
            "id": path,
            "label": PurePosixPath(path).name,
            "folder": _folder_of(path),
            "language": PurePosixPath(path).suffix.lstrip("."),
        }
        for path, _ in relevant if path in kept_paths
    ]

    if len(nodes) > 40:
        connected = {e["source"] for e in edges} | {e["target"] for e in edges}
        nodes = [n for n in nodes if n["id"] in connected]

    node_ids = [n["id"] for n in nodes]
    cycles = _find_cycles(node_ids, edges)

    return {
        "nodes": nodes,
        "edges": edges,
        "cycles": cycles,
        "diagnostics": {
            "resolvedCount": resolved_count,
            "unresolvedCount": unresolved_count,
            "externalCount": external_count,
            "totalCandidateFiles": total_candidate_files,
            "shownFiles": len(nodes),
            "truncated": truncated,
        },
        "unresolved": unresolved,
    }
