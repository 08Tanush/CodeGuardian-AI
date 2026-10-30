import { motion } from "framer-motion";
import { SEVERITIES, CATEGORY_LABELS } from "../utils/severity";
import "./charts.css";

// One row per category, segments stacked by severity. Bar length is shared
// across rows (scaled to the busiest category) so rows compare directly.
export default function SeverityBreakdown({ issues = [] }) {
  const categories = Object.keys(CATEGORY_LABELS);
  const counts = Object.fromEntries(
    categories.map((cat) => [
      cat,
      Object.fromEntries(SEVERITIES.map((sev) => [sev, issues.filter((i) => i.category === cat && i.severity === sev).length])),
    ])
  );
  const totals = Object.fromEntries(categories.map((cat) => [cat, SEVERITIES.reduce((s, sev) => s + counts[cat][sev], 0)]));
  const max = Math.max(1, ...Object.values(totals));

  if (issues.length === 0) {
    return <p className="empty-note">No findings in any category.</p>;
  }

  return (
    <div className="breakdown">
      <ul className="chart-legend" aria-label="Severity legend">
        {SEVERITIES.map((sev) => (
          <li key={sev}>
            <span className={`legend-swatch fill-${sev}`} />
            {sev[0].toUpperCase() + sev.slice(1)}
          </li>
        ))}
      </ul>

      <table className="breakdown-table">
        <caption className="sr-only">Findings by category and severity</caption>
        <thead className="sr-only">
          <tr>
            <th>Category</th>
            {SEVERITIES.map((s) => (
              <th key={s}>{s}</th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <tr key={cat}>
              <th scope="row" className="breakdown-label">
                {CATEGORY_LABELS[cat]}
              </th>
              <td className="breakdown-bar-cell">
                <motion.div
                  className="stack"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  style={{ width: `${(totals[cat] / max) * 100}%` }}
                >
                  {SEVERITIES.filter((sev) => counts[cat][sev] > 0).map((sev) => (
                    <span
                      key={sev}
                      className={`stack-seg fill-${sev}`}
                      style={{ flexGrow: counts[cat][sev] }}
                      tabIndex={0}
                      data-tip={`${CATEGORY_LABELS[cat]}: ${counts[cat][sev]} ${sev}`}
                      aria-label={`${CATEGORY_LABELS[cat]}: ${counts[cat][sev]} ${sev} severity`}
                    />
                  ))}
                </motion.div>
              </td>
              <td className="breakdown-count mono">{totals[cat]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
