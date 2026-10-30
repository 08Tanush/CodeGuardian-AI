import { useMemo, useState } from "react";
import { PiGraph, PiWarning } from "react-icons/pi";
import { computeForceLayout, colorForFolder } from "../utils/forceLayout";
import "./DependencyGraph.css";

const WIDTH = 800;
const MAX_LABEL = 24;
// With many nodes every label collides; above this count only the most
// connected files (and whatever is hovered/focused) get a label.
const ALWAYS_LABEL_UNDER = 18;
const TOP_LABELED = 10;

function shortLabel(label) {
  return label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 3)}...` : label;
}

export default function DependencyGraph({ graph, onFileClick, height = 460 }) {
  const [active, setActive] = useState(null);

  const model = useMemo(() => {
    const nodes = graph?.nodes || [];
    const edges = graph?.edges || [];
    const cycles = graph?.cycles || [];
    // Small graphs get a shorter canvas instead of a sea of empty space.
    const h = Math.min(height, Math.max(260, 160 + nodes.length * 12));
    const positions = computeForceLayout(nodes, edges, { width: WIDTH, height: h });

    const degree = new Map();
    edges.forEach((e) => {
      degree.set(e.source, (degree.get(e.source) || 0) + 1);
      degree.set(e.target, (degree.get(e.target) || 0) + 1);
    });

    const neighbors = new Map(nodes.map((n) => [n.id, new Set([n.id])]));
    edges.forEach((e) => {
      neighbors.get(e.source)?.add(e.target);
      neighbors.get(e.target)?.add(e.source);
    });

    const cycleNodeIds = new Set(cycles.flat());
    const cycleEdgeKeys = new Set();
    cycles.forEach((cycle) => {
      cycle.forEach((from, i) => cycleEdgeKeys.add(`${from}->${cycle[(i + 1) % cycle.length]}`));
    });

    const folderIndexMap = new Map();
    nodes.forEach((n) => colorForFolder(n.folder, folderIndexMap));

    const labeled =
      nodes.length <= ALWAYS_LABEL_UNDER
        ? new Set(nodes.map((n) => n.id))
        : edges.length === 0
        ? new Set() // unconnected nodes give no reason to favor any label; show on hover
        : new Set(
            [...nodes]
              .sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0))
              .slice(0, TOP_LABELED)
              .map((n) => n.id)
          );

    return { h, nodes, edges, positions, degree, neighbors, cycleNodeIds, cycleEdgeKeys, folderIndexMap, labeled };
  }, [graph, height]);

  const { h, nodes, edges, positions, degree, neighbors, cycleNodeIds, cycleEdgeKeys, folderIndexMap, labeled } = model;

  if (nodes.length === 0) {
    return (
      <div className="graph-empty">
        <PiGraph className="graph-empty-icon" />
        <p>No imports between files were detected, so there is no map to draw.</p>
      </div>
    );
  }

  const near = active ? neighbors.get(active) : null;
  const diagnostics = graph?.diagnostics;
  const folders = [...folderIndexMap.keys()];
  const hasEdges = edges.length > 0;

  return (
    <div className="dependency-graph">
      {diagnostics?.truncated && (
        <p className="graph-note">
          <PiWarning />
          Showing the {diagnostics.shownFiles} most connected of {diagnostics.totalCandidateFiles} files. Findings still
          cover every file.
        </p>
      )}
      {!hasEdges && (
        <p className="graph-note">
          <PiWarning />
          No imports between these files resolved, so they're shown unconnected.
        </p>
      )}

      <div className="graph-canvas">
        <svg viewBox={`0 0 ${WIDTH} ${h}`} className="graph-svg" role="group" aria-label="Dependency map">
          <defs>
            <marker id="cg-arrow" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" className="graph-arrow" />
            </marker>
            <marker id="cg-arrow-cycle" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" className="graph-arrow-cycle" />
            </marker>
          </defs>

          <g className="graph-edges">
            {edges.map((e, i) => {
              const a = positions[e.source];
              const b = positions[e.target];
              if (!a || !b) return null;
              const inCycle = cycleEdgeKeys.has(`${e.source}->${e.target}`);
              const dim = near && !(near.has(e.source) && near.has(e.target) && (e.source === active || e.target === active));
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={`graph-edge ${inCycle ? "cycle" : ""} ${dim ? "dim" : ""}`}
                  markerEnd={inCycle ? "url(#cg-arrow-cycle)" : "url(#cg-arrow)"}
                />
              );
            })}
          </g>

          {nodes.map((n) => {
            const pos = positions[n.id];
            if (!pos) return null;
            const r = 4.5 + Math.min(8, (degree.get(n.id) || 0) * 1.2);
            const dim = near && !near.has(n.id);
            const showLabel = labeled.has(n.id) || n.id === active || (near && near.has(n.id));
            const anchorEnd = pos.x > WIDTH - 180;
            return (
              <g
                key={n.id}
                transform={`translate(${pos.x} ${pos.y})`}
                className={`graph-node ${dim ? "dim" : ""} ${n.id === active ? "active" : ""}`}
                tabIndex={0}
                role="button"
                aria-label={`${n.id}, ${degree.get(n.id) || 0} connections. Open explanation.`}
                onMouseEnter={() => setActive(n.id)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(n.id)}
                onBlur={() => setActive(null)}
                onClick={() => onFileClick?.(n.id)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    onFileClick?.(n.id);
                  }
                }}
              >
                <title>{n.id}</title>
                <circle r={r + 8} className="graph-hit" />
                <circle
                  r={r}
                  style={{ fill: colorForFolder(n.folder, folderIndexMap) }}
                  className={`graph-dot ${cycleNodeIds.has(n.id) ? "cycle" : ""}`}
                />
                {showLabel && (
                  <text
                    x={anchorEnd ? -(r + 6) : r + 6}
                    y={4}
                    textAnchor={anchorEnd ? "end" : "start"}
                    className="graph-label"
                  >
                    {n.id === active ? n.label : shortLabel(n.label)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="chart-legend chart-legend-wrap graph-legend">
        {folders.slice(0, 8).map((folder) => (
          <li key={folder}>
            <span className="legend-swatch" style={{ background: colorForFolder(folder, folderIndexMap), borderRadius: 999 }} />
            <span className="mono">{folder}</span>
          </li>
        ))}
        {folders.length > 8 && (
          <li>
            <span className="legend-swatch" style={{ background: "var(--series-other)", borderRadius: 999 }} />
            {folders.length - 8} more folders
          </li>
        )}
        {cycleNodeIds.size > 0 && (
          <li>
            <span className="legend-swatch legend-ring" />
            In a circular import
          </li>
        )}
      </ul>
    </div>
  );
}
