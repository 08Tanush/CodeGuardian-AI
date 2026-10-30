import { useMemo, useState } from "react";
import SeverityTag from "./SeverityTag";
import { SEVERITIES, CATEGORY_LABELS, severityRank } from "../utils/severity";
import "./FindingsList.css";

const PAGE = 30;

function FilterGroup({ label, options, value, onChange }) {
  return (
    <div className="filter-group" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`filter-chip ${value === opt.value ? "active" : ""}`}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
          <span className="mono">{opt.count}</span>
        </button>
      ))}
    </div>
  );
}

export default function FindingsList({ issues = [], onFileClick, limit, filters = true }) {
  const [category, setCategory] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(
    () => [...issues].sort((a, b) => severityRank(a.severity) - severityRank(b.severity)),
    [issues]
  );

  const inCategory = sorted.filter((i) => category === "all" || i.category === category);
  const visible = inCategory.filter((i) => severity === "all" || i.severity === severity);
  const cap = limit ?? (showAll ? Infinity : PAGE);
  const shown = visible.slice(0, cap);

  if (issues.length === 0) {
    return <p className="empty-note">No findings. Static analysis didn't flag anything in this repository.</p>;
  }

  return (
    <div className="findings">
      {filters && (
        <div className="findings-filters">
          <FilterGroup
            label="Filter by category"
            value={category}
            onChange={(v) => {
              setCategory(v);
              setShowAll(false);
            }}
            options={[
              { value: "all", label: "All", count: sorted.length },
              ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
                value,
                label,
                count: sorted.filter((i) => i.category === value).length,
              })),
            ]}
          />
          <FilterGroup
            label="Filter by severity"
            value={severity}
            onChange={(v) => {
              setSeverity(v);
              setShowAll(false);
            }}
            options={[
              { value: "all", label: "Any severity", count: inCategory.length },
              ...SEVERITIES.map((s) => ({
                value: s,
                label: s[0].toUpperCase() + s.slice(1),
                count: inCategory.filter((i) => i.severity === s).length,
              })),
            ]}
          />
        </div>
      )}

      {shown.length === 0 ? (
        <p className="empty-note findings-empty">Nothing matches these filters.</p>
      ) : (
        <ul className="findings-list">
          {shown.map((issue, i) => {
            const clickable = onFileClick && issue.file && issue.file !== "/";
            return (
              <li key={`${issue.file}-${issue.description}-${i}`} className="finding">
                <SeverityTag severity={issue.severity} />
                <div className="finding-body">
                  <p className="finding-desc">{issue.description}</p>
                  <p className="finding-meta">
                    <span>{CATEGORY_LABELS[issue.category] || issue.category}</span>
                    {clickable ? (
                      <button className="finding-file mono" onClick={() => onFileClick(issue.file)} title="Explain this file">
                        {issue.file}
                      </button>
                    ) : (
                      <span className="finding-file mono">{issue.file === "/" ? "Repository root" : issue.file}</span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {limit === undefined && visible.length > PAGE && (
        <button className="btn btn-secondary findings-more" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Show fewer" : `Show all ${visible.length}`}
        </button>
      )}
    </div>
  );
}
