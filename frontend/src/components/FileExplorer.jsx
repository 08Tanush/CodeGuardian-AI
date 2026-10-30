import { useMemo, useState } from "react";
import { PiFolderSimple, PiFolderOpen, PiFileText, PiCaretRight, PiMagnifyingGlass } from "react-icons/pi";
import "./FileExplorer.css";

function flatten(nodes, out = []) {
  nodes.forEach((n) => (n.type === "file" ? out.push(n.path) : flatten(n.children, out)));
  return out;
}

function FolderNode({ node, onFileClick, activePath, depth }) {
  const [open, setOpen] = useState(depth < 1 || (activePath || "").startsWith(`${node.path}/`));
  return (
    <li>
      <button
        className="tree-row"
        style={{ paddingLeft: depth * 14 + 8 }}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <PiCaretRight className={`tree-caret ${open ? "open" : ""}`} />
        {open ? <PiFolderOpen className="tree-icon" /> : <PiFolderSimple className="tree-icon" />}
        <span className="tree-name">{node.name}</span>
      </button>
      {open && (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} onFileClick={onFileClick} activePath={activePath} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function TreeNode({ node, onFileClick, activePath, depth }) {
  if (node.type === "folder") {
    return <FolderNode node={node} onFileClick={onFileClick} activePath={activePath} depth={depth} />;
  }
  const active = activePath === node.path;
  return (
    <li>
      <button
        className={`tree-row tree-file ${active ? "active" : ""}`}
        style={{ paddingLeft: depth * 14 + 26 }}
        onClick={() => onFileClick(node.path)}
        aria-current={active ? "true" : undefined}
      >
        <PiFileText className="tree-icon" />
        <span className="tree-name">{node.name}</span>
      </button>
    </li>
  );
}

export default function FileExplorer({ tree, onFileClick, activePath }) {
  const [query, setQuery] = useState("");
  const allPaths = useMemo(() => flatten(tree || []), [tree]);
  const q = query.trim().toLowerCase();
  const matches = q ? allPaths.filter((p) => p.toLowerCase().includes(q)) : null;

  if (!tree || tree.length === 0) {
    return <p className="empty-note tree-empty">No readable source files were found in this repository.</p>;
  }

  return (
    <div className="file-explorer">
      <label className="tree-search">
        <PiMagnifyingGlass aria-hidden="true" />
        <span className="sr-only">Filter files</span>
        <input type="search" placeholder={`Filter ${allPaths.length} files`} value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <ul className="tree">
        {matches
          ? matches.slice(0, 200).map((path) => (
              <li key={path}>
                <button
                  className={`tree-row tree-file ${activePath === path ? "active" : ""}`}
                  style={{ paddingLeft: 8 }}
                  onClick={() => onFileClick(path)}
                >
                  <PiFileText className="tree-icon" />
                  <span className="tree-name mono">{path}</span>
                </button>
              </li>
            ))
          : tree.map((node) => (
              <TreeNode key={node.path} node={node} onFileClick={onFileClick} activePath={activePath} depth={0} />
            ))}
        {matches && matches.length === 0 && <li className="empty-note tree-empty">No files match.</li>}
      </ul>
    </div>
  );
}
