import { motion } from "framer-motion";
import { scoreVerdict } from "../utils/severity";
import "./ScoreGauge.css";

// 240-degree arc meter. Color is a status cue; the number and verdict carry the meaning.
const SWEEP = 240;
const R = 54;
const C = 2 * Math.PI * R;
const ARC = (C * SWEEP) / 360;

export default function ScoreGauge({ score = 0, size = 168 }) {
  const { label, tone } = scoreVerdict(score);
  const filled = (ARC * Math.max(0, Math.min(100, score))) / 100;

  return (
    <div className={`score-gauge tone-${tone}`} style={{ width: size }}>
      <svg viewBox="0 0 128 128" role="img" aria-label={`Maintainability score ${score} out of 100, ${label}`}>
        <g transform="rotate(150 64 64)">
          <circle className="score-track" cx="64" cy="64" r={R} strokeDasharray={`${ARC} ${C}`} />
          <motion.circle
            className="score-fill"
            cx="64"
            cy="64"
            r={R}
            initial={{ strokeDasharray: `0 ${C}` }}
            animate={{ strokeDasharray: `${filled} ${C}` }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        </g>
      </svg>
      <div className="score-gauge-center">
        <strong>{score}</strong>
        <span>of 100</span>
      </div>
      <p className="score-gauge-verdict">{label}</p>
    </div>
  );
}
