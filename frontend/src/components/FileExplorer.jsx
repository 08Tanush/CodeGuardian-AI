import { useState } from "react";
import { HiOutlineFolder, HiOutlineFolderOpen, HiOutlineDocument, HiChevronRight } from "react-icons/hi2";
import "./FileExplorer.css";

function FolderNode({ node, onFileClick, activePath, depth }) {
  const [open, setOpen] = useState(depth < 1);

  return (
    <div className="file-node">
      <button className="file-node-row folder-row" style={{ paddingLeft: `${depth * 16 + 12}px` }} onClick={() => setOpen((o) => !o)}>
        <HiChevronRight className={`file-node-chevron ${open ? "open" : ""}`} />
        {open ? <HiOutlineFolderOpen className="file-node-icon folder" /> : <HiOutlineFolder className="file-node-icon folder" />}
        <span>{node.name}</span>
      </button>
      {open && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} onFileClick={onFileClick} activePath={activePath} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeNode({ node, onFileClick, activePath, depth }) {
  if (node.type === "folder") {
    return <FolderNode node={node} onFileClick={onFileClick} activePath={activePath} depth={depth} />;
  }
  return (
    <button
      className={`file-node-row file-row ${activePath === node.path ? "active" : ""}`}
      style={{ paddingLeft: `${depth * 16 + 32}px` }}
      onClick={() => onFileClick(node.path)}
    >
      <HiOutlineDocument className="file-node-icon file" />
      <span>{node.name}</span>
    </button>
  );
}

export default function FileExplorer({ tree, onFileClick, activePath }) {
  if (!tree || tree.length === 0) {
    return <p className="file-explorer-empty">No readable source files were found in this repository.</p>;
  }

  return (
    <div className="file-explorer">
      {tree.map((node) => (
        <TreeNode key={node.path} node={node} onFileClick={onFileClick} activePath={activePath} depth={0} />
      ))}
    </div>
  );
}
