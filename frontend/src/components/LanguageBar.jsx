import { useMemo } from "react";
import "./charts.css";

const SLOTS = 7; // seven named languages, the rest fold into "Other"

// Largest-remainder rounding so displayed percentages always sum to 100.
function roundTo100(values) {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const raw = values.map((v) => (v / total) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  raw
    .map((r, i) => ({ i, frac: r - floors[i] }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ i }) => {
      if (left > 0) {
        floors[i] += 1;
        left -= 1;
      }
    });
  return floors;
}

export default function LanguageBar({ breakdown = {} }) {
  const segments = useMemo(() => {
    const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
    const head = sorted.slice(0, SLOTS);
    const otherCount = sorted.slice(SLOTS).reduce((s, [, n]) => s + n, 0);
    const rows = head.map(([lang, count], i) => ({ lang, count, color: `var(--series-${i + 1})` }));
    if (otherCount) rows.push({ lang: "Other", count: otherCount, color: "var(--series-other)" });
    const pcts = roundTo100(rows.map((r) => r.count));
    return rows.map((r, i) => ({ ...r, pct: pcts[i] }));
  }, [breakdown]);

  if (segments.length === 0) {
    return <p className="empty-note">No recognized source files.</p>;
  }

  return (
    <div className="langbar">
      <div className="stack stack-tall" role="img" aria-label="Files by language">
        {segments.map((s) => (
          <span
            key={s.lang}
            className="stack-seg"
            style={{ flexGrow: s.count, background: s.color }}
            tabIndex={0}
            data-tip={`${s.lang}: ${s.count} files (${s.pct}%)`}
            aria-label={`${s.lang}: ${s.count} files, ${s.pct} percent`}
          />
        ))}
      </div>
      <ul className="chart-legend chart-legend-wrap">
        {segments.map((s) => (
          <li key={s.lang}>
            <span className="legend-swatch" style={{ background: s.color }} />
            {s.lang}
            <span className="legend-value mono">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
