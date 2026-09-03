import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { HiCheckCircle, HiOutlineExclamationTriangle } from "react-icons/hi2";
import { useAnalysisContext } from "../context/AnalysisContext";
import { uploadZip, uploadGithubUrl } from "../services/api";
import "./Loading.css";

const STEPS = [
  "Reading repository",
  "Extracting files",
  "Understanding code",
  "Running AI analysis",
  "Building report",
  "Finalizing dashboard",
];

export default function Loading() {
  const navigate = useNavigate();
  const { pendingRequest, setSession } = useAnalysisContext();
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(6);
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (!pendingRequest) {
      navigate("/upload");
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    // Step timer purely for visual feedback - it doesn't gate the real request.
    const stepInterval = setInterval(() => {
      setActiveStep((s) => (s < STEPS.length - 1 ? s + 1 : s));
    }, 1100);

    const progressInterval = setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.random() * 6 : p));
    }, 350);

    const run = async () => {
      try {
        const data =
          pendingRequest.mode === "zip"
            ? await uploadZip(pendingRequest.file)
            : await uploadGithubUrl(pendingRequest.url);

        setActiveStep(STEPS.length - 1);
        setProgress(100);
        setSession({ id: data.id, analysis: data.analysis });

        setTimeout(() => navigate(`/dashboard/${data.id}`), 500);
      } catch (err) {
        setError(err.message || "Analysis failed. Please try again.");
      } finally {
        clearInterval(stepInterval);
        clearInterval(progressInterval);
      }
    };

    run();

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRequest]);

  return (
    <main className="loading-page">
      <div className="loading-card">
        {error ? (
          <>
            <div className="loading-error-icon">
              <HiOutlineExclamationTriangle />
            </div>
            <h2>Analysis failed</h2>
            <p className="loading-error-message">{error}</p>
            <button className="btn btn-primary" onClick={() => navigate("/upload")}>
              Try again
            </button>
          </>
        ) : (
          <>
            <div className="loading-ring">
              <svg viewBox="0 0 100 100">
                <circle className="ring-track" cx="50" cy="50" r="44" />
                <motion.circle
                  className="ring-progress"
                  cx="50"
                  cy="50"
                  r="44"
                  strokeDasharray={276}
                  animate={{ strokeDashoffset: 276 - (276 * progress) / 100 }}
                  transition={{ ease: "easeOut", duration: 0.3 }}
                />
              </svg>
              <span className="loading-ring-value">{Math.min(100, Math.round(progress))}%</span>
            </div>

            <h2>Analyzing your repository</h2>
            <p className="loading-subtitle">This usually takes under a minute.</p>

            <ul className="loading-steps">
              {STEPS.map((step, i) => (
                <li key={step} className={i < activeStep ? "done" : i === activeStep ? "active" : ""}>
                  <span className="loading-step-marker">
                    {i < activeStep ? <HiCheckCircle /> : <span className="loading-step-dot" />}
                  </span>
                  {step}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
