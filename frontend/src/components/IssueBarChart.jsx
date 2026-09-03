import { motion } from "framer-motion";
import "./IssueBarChart.css";

const CATEGORY_META = {
  security: { label: "Security", color: "var(--danger)" },
  quality: { label: "Code quality", color: "var(--primary)" },
  documentation: { label: "Documentation", color: "var(--secondary)" },
};

export default function IssueBarChart({ distribution = {} }) {
  const entries = Object.entries(distribution);
  const max = Math.max(1, ...entries.map(([, count]) => count));

  if (entries.length === 0) {
    return <p className="issue-chart-empty">No issues found — nice work!</p>;
  }

  return (
    <div className="issue-chart">
      {entries.map(([category, count]) => {
        const meta = CATEGORY_META[category] || { label: category, color: "var(--text-muted)" };
        return (
          <div className="issue-chart-row" key={category}>
            <span className="issue-chart-label">{meta.label}</span>
            <div className="issue-chart-track">
              <motion.div
                className="issue-chart-fill"
                style={{ background: meta.color }}
                initial={{ width: 0 }}
                animate={{ width: `${(count / max) * 100}%` }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="issue-chart-count">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
