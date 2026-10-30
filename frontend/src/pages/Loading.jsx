import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PiCheckBold, PiWarningCircle } from "react-icons/pi";
import Navbar from "../components/Navbar";
import { useAnalysisContext } from "../context/AnalysisContext";
import { uploadZip, uploadGithubUrl } from "../services/api";
import usePageTitle from "../hooks/usePageTitle";
import "./Loading.css";

// Stages reflect what is really happening: a ZIP has a measurable upload,
// then one server request does the analysis; a GitHub URL is a single
// request (clone + analyze) with no measurable progress.
function stagesFor(mode) {
  return mode === "zip"
    ? ["Uploading archive", "Scanning files and building the report", "Opening dashboard"]
    : ["Cloning repository and scanning files", "Opening dashboard"];
}

export default function Loading() {
  usePageTitle("Analyzing");
  const navigate = useNavigate();
  const { pendingRequest, setSession } = useAnalysisContext();
  const [stage, setStage] = useState(0);
  const [uploadPct, setUploadPct] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  // The request must fire exactly once, even under StrictMode's double effect.
  useEffect(() => {
    if (!pendingRequest) {
      navigate("/upload", { replace: true });
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    const isZip = pendingRequest.mode === "zip";
    const last = stagesFor(pendingRequest.mode).length - 1;
    const request = isZip
      ? uploadZip(pendingRequest.file, (pct) => {
          setUploadPct(pct);
          if (pct >= 100) setStage(1);
        })
      : uploadGithubUrl(pendingRequest.url);

    request
      .then((data) => {
        setStage(last);
        setSession({ id: data.id, analysis: data.analysis });
        navigate(`/dashboard/${data.id}`, { replace: true });
      })
      .catch((err) => setError(err.message || "Analysis failed. Please try again."));
  }, [pendingRequest, navigate, setSession]);

  useEffect(() => {
    if (error) return undefined;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [error]);

  if (!pendingRequest) return null;
  const stages = stagesFor(pendingRequest.mode);
  const source = pendingRequest.mode === "zip" ? pendingRequest.file.name : pendingRequest.url;

  return (
    <>
      <Navbar />
      <main id="main" className="page loading-page">
        <div className="container loading-wrap">
          <div className="loading-card panel" aria-live="polite">
            {error ? (
              <div className="loading-error">
                <PiWarningCircle className="loading-error-icon" />
                <h1>Analysis failed</h1>
                <p>{error}</p>
                <div className="loading-error-actions">
                  <Link to="/upload" className="btn btn-primary">
                    Try again
                  </Link>
                  <Link to="/" className="btn btn-secondary">
                    Home
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <h1>Analyzing</h1>
                <p className="loading-source mono">{source}</p>

                <ol className="loading-stages">
                  {stages.map((label, i) => {
                    const state = i < stage ? "done" : i === stage ? "active" : "todo";
                    const measurable = pendingRequest.mode === "zip" && i === 0;
                    return (
                      <li key={label} className={`stage ${state}`}>
                        <span className="stage-marker">{state === "done" ? <PiCheckBold /> : null}</span>
                        <div className="stage-body">
                          <span>{label}</span>
                          {state === "active" && (
                            <div
                              className={`stage-bar ${measurable ? "" : "indeterminate"}`}
                              role="progressbar"
                              aria-label={label}
                              aria-valuenow={measurable ? uploadPct : undefined}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <span style={measurable ? { transform: `scaleX(${uploadPct / 100})` } : undefined} />
                            </div>
                          )}
                        </div>
                        {state === "active" && measurable && <span className="stage-pct mono">{uploadPct}%</span>}
                      </li>
                    );
                  })}
                </ol>

                <p className="loading-time">
                  <span className="mono">{seconds}s</span> elapsed. Large repositories can take a couple of minutes.
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
