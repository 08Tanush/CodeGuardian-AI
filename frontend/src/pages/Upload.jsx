import { useCallback, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { PiFileZip, PiGithubLogo, PiUploadSimple, PiX, PiWarningCircle, PiArrowRight } from "react-icons/pi";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useAnalysisContext } from "../context/AnalysisContext";
import usePageTitle from "../hooks/usePageTitle";
import useRobotsMeta from "../hooks/useRobotsMeta";
import "./Upload.css";

const MAX_ZIP_MB = 50;
const GITHUB_RE = /^(https?:\/\/)?(www\.)?github\.com\/[\w.-]+\/[\w.-]+([/?#].*)?$|^git@github\.com:[\w.-]+\/[\w.-]+(\.git)?$/i;

function formatSize(bytes) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Upload() {
  usePageTitle("Analyze a repository");
  useRobotsMeta(false);
  const navigate = useNavigate();
  const { setPendingRequest } = useAnalysisContext();
  const urlId = useId();
  const errorId = useId();

  const [mode, setMode] = useState("zip");
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const pickFile = useCallback((candidate) => {
    setError("");
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".zip")) {
      setError("That isn't a .zip file. Compress the project folder first, then upload the archive.");
      return;
    }
    if (candidate.size > MAX_ZIP_MB * 1024 * 1024) {
      setError(`That file is ${formatSize(candidate.size)}. The limit is ${MAX_ZIP_MB} MB; try excluding node_modules or build output.`);
      return;
    }
    setFile(candidate);
  }, []);

  const switchMode = (next) => {
    setMode(next);
    setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (mode === "zip") {
      if (!file) {
        setError("Choose a .zip file to analyze.");
        return;
      }
      setPendingRequest({ mode: "zip", file });
    } else {
      const trimmed = url.trim();
      if (!GITHUB_RE.test(trimmed)) {
        setError("Enter a repository URL like https://github.com/owner/repo.");
        return;
      }
      setPendingRequest({ mode: "github", url: trimmed });
    }
    navigate("/analyzing");
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <>
      <Navbar />
      <main id="main" className="page upload-page">
        <div className="container upload-layout">
          <motion.div
            className="upload-intro"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1>Analyze a repository</h1>
            <p>Upload a ZIP of your project or paste a public GitHub URL. Most repositories finish in under a minute.</p>
            <ul className="upload-facts">
              <li>Dependencies, build output, and .git are skipped automatically.</li>
              <li>Results stay available at their own link, so you can share the dashboard.</li>
              <li>Private GitHub repositories aren't supported; upload them as a ZIP.</li>
            </ul>
          </motion.div>

          <motion.form
            className="upload-card panel"
            onSubmit={handleSubmit}
            noValidate
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="segmented" role="tablist" aria-label="Source">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "zip"}
                className={mode === "zip" ? "active" : ""}
                onClick={() => switchMode("zip")}
              >
                <PiFileZip /> ZIP file
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "github"}
                className={mode === "github" ? "active" : ""}
                onClick={() => switchMode("github")}
              >
                <PiGithubLogo /> GitHub URL
              </button>
            </div>

            {mode === "zip" ? (
              <div className="field">
                <span className="field-label">Project archive</span>
                <input
                  key="zip-input"
                  ref={inputRef}
                  type="file"
                  accept=".zip,application/zip"
                  hidden
                  onChange={(e) => {
                    pickFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {file ? (
                  <div className="file-chip">
                    <PiFileZip className="file-chip-icon" />
                    <div className="file-chip-text">
                      <p className="mono">{file.name}</p>
                      <p className="field-help">{formatSize(file.size)}</p>
                    </div>
                    <button type="button" className="btn btn-quiet" onClick={() => setFile(null)} aria-label="Remove file">
                      <PiX />
                    </button>
                  </div>
                ) : (
                  <div
                    className={`dropzone ${isDragging ? "dragging" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      pickFile(e.dataTransfer.files?.[0]);
                    }}
                    onClick={openPicker}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openPicker();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-describedby={error ? errorId : undefined}
                  >
                    <PiUploadSimple className="dropzone-icon" />
                    <p className="dropzone-title">Drop a .zip here, or click to choose</p>
                    <p className="field-help">Up to {MAX_ZIP_MB} MB</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="field">
                <label className="field-label" htmlFor={urlId}>
                  Repository URL
                </label>
                <input
                  key="url-input"
                  id={urlId}
                  className="text-input mono"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://github.com/owner/repo"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError("");
                  }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : `${urlId}-help`}
                />
                <p className="field-help" id={`${urlId}-help`}>
                  Public repositories only. The default branch is analyzed.
                </p>
              </div>
            )}

            {error && (
              <p className="field-error" id={errorId} role="alert">
                <PiWarningCircle /> {error}
              </p>
            )}

            <button type="submit" className="btn btn-primary btn-lg upload-submit">
              Start analysis <PiArrowRight />
            </button>
          </motion.form>
        </div>
      </main>
      <Footer />
    </>
  );
}
