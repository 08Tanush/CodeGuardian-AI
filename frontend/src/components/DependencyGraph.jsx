import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { HiOutlineCubeTransparent, HiOutlineExclamationTriangle } from "react-icons/hi2";
import { computeForceLayout, colorForFolder } from "../utils/forceLayout";
import "./DependencyGraph.css";

const WIDTH = 800;
const HEIGHT = 520;

export default function DependencyGraph({ graph, onFileClick, height = HEIGHT }) {
  const [hovered, setHovered] = useState(null);

  const { nodes, edges, positions, folders, degree, cycleNodeIds, cycleEdgeKeys } = useMemo(() => {
    const nodes = graph?.nodes || [];
    const edges = graph?.edges || [];
    const cycles = graph?.cycles || [];
    const positions = computeForceLayout(nodes, edges, { width: WIDTH, height });

    const degree = new Map();
    edges.forEach((e) => {
      degree.set(e.source, (degree.get(e.source) || 0) + 1);
      degree.set(e.target, (degree.get(e.target) || 0) + 1);
    });

    const cycleNodeIds = new Set(cycles.flat());
    const cycleEdgeKeys = new Set();
    cycles.forEach((cycle) => {
      for (let i = 0; i < cycle.length; i++) {
        const from = cycle[i];
        const to = cycle[(i + 1) % cycle.length];
        cycleEdgeKeys.add(`${from}->${to}`);
      }
    });

    const folderIndexMap = new Map();
    nodes.forEach((n) => colorForFolder(n.folder, folderIndexMap));
    const folders = [...folderIndexMap.keys()];

    return { nodes, edges, positions, folders, degree, cycleNodeIds, cycleEdgeKeys };
  }, [graph, height]);

  const folderIndexMap = useMemo(() => {
    const map = new Map();
    folders.forEach((f) => map.set(f, folders.indexOf(f)));
    return map;
  }, [folders]);

  if (nodes.length === 0) {
    return (
      <div className="graph-empty">
        <HiOutlineCubeTransparent className="graph-empty-icon" />
        <p>No import relationships were detected between files, so there's no map to draw yet.</p>
      </div>
    );
  }

  const connectedTo = (id) => {
    if (!hovered) return null;
    const set = new Set([hovered]);
    edges.forEach((e) => {
      if (e.source === hovered) set.add(e.target);
      if (e.target === hovered) set.add(e.source);
    });
    return set.has(id);
  };

  const diagnostics = graph?.diagnostics;

  return (
    <div className="dependency-graph">
      {diagnostics?.truncated && (
        <div className="graph-truncation-banner">
          <HiOutlineExclamationTriangle />
          Showing {diagnostics.shownFiles} of {diagnostics.totalCandidateFiles} files, prioritized by how
          connected they are. The full analysis above still covers every file - this limit is for graph
          readability only.
        </div>
      )}
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="graph-svg">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--text-muted)" />
          </marker>
          <marker id="arrow-cycle" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--danger)" />
          </marker>
        </defs>

        {edges.map((e, i) => {
          const a = positions[e.source];
          const b = positions[e.target];
          if (!a || !b) return null;
          const dimmed = hovered && !(connectedTo(e.source) && connectedTo(e.target));
          const inCycle = cycleEdgeKeys.has(`${e.source}->${e.target}`);
          return (
            <motion.line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={inCycle ? "var(--danger)" : "var(--text-muted)"}
              strokeWidth={dimmed ? 0.6 : inCycle ? 1.6 : 1.1}
              opacity={dimmed ? 0.08 : inCycle ? 0.75 : 0.45}
              markerEnd={inCycle ? "url(#arrow-cycle)" : "url(#arrow)"}
              initial={{ opacity: 0 }}
              animate={{ opacity: dimmed ? 0.08 : inCycle ? 0.75 : 0.45 }}
              transition={{ duration: 0.3 }}
            />
          );
        })}

        {nodes.map((n) => {
          const pos = positions[n.id];
          if (!pos) return null;
          const color = colorForFolder(n.folder, folderIndexMap);
          const size = 5 + Math.min(10, (degree.get(n.id) || 0) * 1.6);
          const dimmed = hovered && !connectedTo(n.id);
          const inCycle = cycleNodeIds.has(n.id);

          return (
            <motion.g
              key={n.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: dimmed ? 0.25 : 1, x: pos.x, y: pos.y }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onFileClick?.(n.id)}
              className="graph-node"
            >
              <circle
                r={size}
                fill={color}
                fillOpacity={0.85}
                stroke={inCycle ? "var(--danger)" : color}
                strokeWidth={inCycle ? 2.5 : 1.5}
              />
              <text
                x={size + 6}
                y={4}
                className="graph-node-label"
                fill={hovered === n.id ? "var(--text)" : "var(--text-secondary)"}
              >
                {n.label}
              </text>
            </motion.g>
          );
        })}
      </svg>

      <div className="graph-legend">
        {folders.map((folder) => (
          <span key={folder} className="graph-legend-item">
            <span className="graph-legend-dot" style={{ background: colorForFolder(folder, folderIndexMap) }} />
            {folder}
          </span>
        ))}
        {cycleNodeIds.size > 0 && (
          <span className="graph-legend-item">
            <span className="graph-legend-dot" style={{ background: "var(--danger)" }} />
            Circular dependency
          </span>
        )}
      </div>
    </div>
  );
}
