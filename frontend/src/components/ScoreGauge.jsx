import { motion } from "framer-motion";
import "./ScoreGauge.css";

function scoreColor(score) {
  if (score >= 80) return "var(--success)";
  if (score >= 55) return "var(--warning)";
  return "var(--danger)";
}

export default function ScoreGauge({ score = 0, label = "Maintainability" }) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const color = scoreColor(score);

  return (
    <div className="score-gauge">
      <svg viewBox="0 0 160 160">
        <circle className="score-track" cx="80" cy="80" r={radius} />
        <motion.circle
          className="score-progress"
          cx="80"
          cy="80"
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (circumference * score) / 100 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="score-gauge-value">
        <strong>{score}</strong>
        <span>/ 100</span>
      </div>
      <p className="score-gauge-label">{label}</p>
    </div>
  );
}
