import { motion, AnimatePresence } from "framer-motion";
import {
  HiOutlineDocument,
  HiOutlineLightBulb,
  HiOutlineCog6Tooth,
  HiOutlineArrowPath,
  HiOutlineWrenchScrewdriver,
  HiOutlineChartBar,
} from "react-icons/hi2";
import "./FileExplainerPanel.css";

function complexityAccent(level) {
  if (level === "High") return "danger";
  if (level === "Medium") return "warning";
  return "success";
}

export default function FileExplainerPanel({ path, loading, error, explanation }) {
  if (!path) {
    return (
      <div className="explainer-panel explainer-empty">
        <HiOutlineDocument className="explainer-empty-icon" />
        <p>Select a file on the left to get an AI explanation of its purpose, logic, and flow.</p>
      </div>
    );
  }

  return (
    <div className="explainer-panel">
      <div className="explainer-panel-header">
        <HiOutlineDocument />
        <span className="explainer-path">{path}</span>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            className="explainer-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className="explainer-spinner" />
            Explaining this file…
          </motion.div>
        ) : error ? (
          <motion.p key="error" className="explainer-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {error}
          </motion.p>
        ) : explanation ? (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="explainer-content"
          >
            <div className={`explainer-complexity accent-${complexityAccent(explanation.complexity)}`}>
              <HiOutlineChartBar /> Complexity: {explanation.complexity}
            </div>

            <ExplainerBlock icon={<HiOutlineLightBulb />} title="Purpose" text={explanation.purpose} />
            <ExplainerBlock icon={<HiOutlineCog6Tooth />} title="Logic" text={explanation.logic} />
            <ExplainerBlock icon={<HiOutlineArrowPath />} title="Flow" text={explanation.flow} />

            <div className="explainer-block">
              <div className="explainer-block-title">
                <HiOutlineWrenchScrewdriver /> Possible improvements
              </div>
              <ul>
                {(explanation.improvements || []).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            {explanation.source === "heuristic" && (
              <p className="explainer-note">
                Heuristic explanation — set <code>GROQ_API_KEY</code> on the backend for a full AI explanation.
              </p>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ExplainerBlock({ icon, title, text }) {
  return (
    <div className="explainer-block">
      <div className="explainer-block-title">
        {icon} {title}
      </div>
      <p>{text}</p>
    </div>
  );
}
