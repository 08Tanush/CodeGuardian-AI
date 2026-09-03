import { useMemo } from "react";
import "./LanguageDonut.css";

const COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16", "#7e8fae"];

export default function LanguageDonut({ breakdown = {} }) {
  const { segments, gradient, total } = useMemo(() => {
    const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, count]) => sum + count, 0) || 1;

    let cursor = 0;
    const segments = entries.map(([lang, count], i) => {
      const pct = (count / total) * 100;
      const seg = { lang, count, pct, color: COLORS[i % COLORS.length], start: cursor };
      cursor += pct;
      return seg;
    });

    const gradient = segments
      .map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`)
      .join(", ");

    return { segments, gradient, total };
  }, [breakdown]);

  if (segments.length === 0) {
    return <p className="donut-empty">No language data available.</p>;
  }

  return (
    <div className="language-donut">
      <div className="donut-ring" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="donut-hole">
          <strong>{total}</strong>
          <span>files</span>
        </div>
      </div>
      <ul className="donut-legend">
        {segments.slice(0, 6).map((s) => (
          <li key={s.lang}>
            <span className="donut-legend-dot" style={{ background: s.color }} />
            <span className="donut-legend-label">{s.lang}</span>
            <span className="donut-legend-pct">{Math.round(s.pct)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
