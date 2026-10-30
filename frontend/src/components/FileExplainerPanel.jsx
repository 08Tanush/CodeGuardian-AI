import { PiFileCode, PiCursorClick } from "react-icons/pi";
import "./FileExplainerPanel.css";

const COMPLEXITY_CLASS = { High: "sev-high", Medium: "sev-medium", Low: "sev-low" };

export default function FileExplainerPanel({ path, loading, error, explanation }) {
  if (!path) {
    return (
      <div className="explainer explainer-empty">
        <PiCursorClick className="explainer-empty-icon" />
        <p>Pick a file to see what it does, what it depends on, and what to improve.</p>
      </div>
    );
  }

  return (
    <div className="explainer" aria-live="polite" aria-busy={loading}>
      <div className="explainer-head">
        <PiFileCode />
        <span className="mono explainer-path">{path}</span>
        {explanation && !loading && (
          <span className={`sev-tag ${COMPLEXITY_CLASS[explanation.complexity] || "sev-low"}`}>
            {explanation.complexity} complexity
          </span>
        )}
      </div>

      {loading ? (
        <div className="explainer-body" aria-label="Loading explanation">
          {[70, 95, 60, 85, 40].map((w, i) => (
            <div key={i} className="skeleton explainer-skel" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : error ? (
        <p className="explainer-error" role="alert">
          {error}
        </p>
      ) : explanation ? (
        <div className="explainer-body">
          <Block title="Purpose" text={explanation.purpose} />
          <Block title="Logic" text={explanation.logic} />
          <Block title="Flow" text={explanation.flow} />
          <section className="explainer-block">
            <h4>Improvements</h4>
            {(explanation.improvements || []).length > 0 ? (
              <ul className="explainer-list">
                {explanation.improvements.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="empty-note">None suggested.</p>
            )}
          </section>
          {explanation.source === "heuristic" && (
            <p className="explainer-note">Based on static parsing. AI explanations aren't enabled on this server.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Block({ title, text }) {
  return (
    <section className="explainer-block">
      <h4>{title}</h4>
      <p>{text}</p>
    </section>
  );
}
