// forceLayout.js
// A tiny, dependency-free force-directed layout so the architecture map
// doesn't need to pull in d3 or a graph library (keeps the install light).
// Runs a fixed number of physics steps synchronously and returns final
// {id -> {x, y}} positions inside the given width/height.

export function computeForceLayout(nodes, edges, { width = 800, height = 520, iterations = 260 } = {}) {
  if (nodes.length === 0) return {};

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2.6;

  // Seed positions on a circle so the simulation starts spread out instead
  // of stacked at the center (which tends to produce messier layouts).
  const positions = new Map();
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    positions.set(n.id, {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
    });
  });

  const repulsion = 2600;
  const springLength = 110;
  const springStrength = 0.02;
  const centerStrength = 0.012;
  const damping = 0.82;

  for (let step = 0; step < iterations; step++) {
    // Node-node repulsion (all pairs - fine for the node counts we render)
    for (let i = 0; i < nodes.length; i++) {
      const a = positions.get(nodes[i].id);
      for (let j = i + 1; j < nodes.length; j++) {
        const b = positions.get(nodes[j].id);
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let distSq = dx * dx + dy * dy || 0.01;
        const force = repulsion / distSq;
        const dist = Math.sqrt(distSq);
        dx /= dist;
        dy /= dist;
        a.vx += dx * force;
        a.vy += dy * force;
        b.vx -= dx * force;
        b.vy -= dy * force;
      }
    }

    // Edge springs pull connected nodes toward a natural resting distance
    edges.forEach((e) => {
      const a = positions.get(e.source);
      const b = positions.get(e.target);
      if (!a || !b) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const diff = (dist - springLength) * springStrength;
      const fx = (dx / dist) * diff;
      const fy = (dy / dist) * diff;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    });

    // Gentle pull toward center so the whole graph stays framed
    positions.forEach((p) => {
      p.vx += (cx - p.x) * centerStrength;
      p.vy += (cy - p.y) * centerStrength;
    });

    positions.forEach((p) => {
      p.vx *= damping;
      p.vy *= damping;
      p.x += p.vx;
      p.y += p.vy;
    });
  }

  const margin = 40;
  const result = {};
  positions.forEach((p, id) => {
    result[id] = {
      x: Math.max(margin, Math.min(width - margin, p.x)),
      y: Math.max(margin, Math.min(height - margin, p.y)),
    };
  });
  return result;
}

const PALETTE = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

export function colorForFolder(folder, folderIndexMap) {
  if (!folderIndexMap.has(folder)) {
    folderIndexMap.set(folder, folderIndexMap.size);
  }
  return PALETTE[folderIndexMap.get(folder) % PALETTE.length];
}
