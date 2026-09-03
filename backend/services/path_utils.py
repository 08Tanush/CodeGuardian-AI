"""
path_utils.py
Canonical path normalization.

This exists because of a real cross-platform bug: `str(path.relative_to(root))`
produces OS-native separators - backslashes on Windows, forward slashes on
Linux/Mac. Every other module (dependency_graph.py's PurePosixPath-based
import resolution, the frontend's file tree, issue file references) assumes
forward-slash paths. On Windows, that mismatch silently broke dependency
graph edge resolution, since paths built by analyzer.py (backslash) never
matched paths looked up by dependency_graph.py (forward-slash).

Every path that becomes a "file id" anywhere in the system - file tree
nodes, graph nodes/edges, issue file references, AI evidence, report
references - must go through normalize_path() exactly once, at the point
it's first constructed from a filesystem Path. Never build a canonical path
directly with str(path) or os.path join logic elsewhere.
"""


def normalize_path(path: str) -> str:
    """
    Turn any of: 'src\\App.jsx', '/src/App.jsx', './src/App.jsx',
    'src//App.jsx' into the single canonical form: 'src/App.jsx'.
    """
    if not path:
        return path
    p = path.replace("\\", "/")
    segments = [seg for seg in p.split("/") if seg not in ("", ".")]
    return "/".join(segments)
