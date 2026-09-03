import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  HiOutlineCloudArrowUp,
  HiOutlineDocumentArrowUp,
  HiOutlineLink,
  HiOutlineExclamationTriangle,
  HiArrowRight,
  HiXMark,
} from "react-icons/hi2";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useAnalysisContext } from "../context/AnalysisContext";
import usePageTitle from "../hooks/usePageTitle";
import "./Upload.css";

const MAX_ZIP_MB = 50;

export default function Upload() {
  usePageTitle("Analyze Repository");
  const navigate = useNavigate();
  const { setPendingRequest } = useAnalysisContext();

  const [mode, setMode] = useState("zip"); // 'zip' | 'github'
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const validateAndSetFile = useCallback((candidate) => {
    setError("");
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".zip")) {
      setError("Please choose a .zip file.");
      return;
    }
    if (candidate.size > MAX_ZIP_MB * 1024 * 1024) {
      setError(`That file is larger than the ${MAX_ZIP_MB}MB limit for this demo.`);
      return;
    }
    setFile(candidate);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    validateAndSetFile(dropped);
  };

  const handleSubmit = () => {
    setError("");
    if (mode === "zip") {
      if (!file) {
        setError("Choose a ZIP file to analyze first.");
        return;
      }
      setPendingRequest({ mode: "zip", file });
    } else {
      const trimmed = url.trim();
      if (!trimmed || !trimmed.includes("github.com")) {
        setError("Enter a valid public GitHub repository URL.");
        return;
      }
      setPendingRequest({ mode: "github", url: trimmed });
    }
    navigate("/analyzing");
  };

  return (
    <>
      <Navbar />
      <main className="page upload-page">
        <div className="container upload-container">
          <motion.div
            className="upload-heading"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="section-eyebrow">Start an analysis</span>
            <h1>Bring in a repository</h1>
            <p>Upload a ZIP archive of your project, or point CodeGuardian at a public GitHub URL.</p>
          </motion.div>

          <motion.div
            className="upload-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
          >
            <div className="upload-tabs">
              <button
                className={mode === "zip" ? "active" : ""}
                onClick={() => { setMode("zip"); setError(""); }}
              >
                <HiOutlineDocumentArrowUp /> Upload ZIP
              </button>
              <button
                className={mode === "github" ? "active" : ""}
                onClick={() => { setMode("github"); setError(""); }}
              >
                <HiOutlineLink /> GitHub URL
              </button>
            </div>

            {mode === "zip" ? (
              <div
                className={`dropzone ${isDragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".zip"
                  hidden
                  onChange={(e) => validateAndSetFile(e.target.files?.[0])}
                />
                {file ? (
                  <div className="dropzone-file">
                    <HiOutlineDocumentArrowUp className="dropzone-file-icon" />
                    <div>
                      <p className="dropzone-file-name">{file.name}</p>
                      <p className="dropzone-file-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <button
                      className="dropzone-clear"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      aria-label="Remove file"
                    >
                      <HiXMark />
                    </button>
                  </div>
                ) : (
                  <>
                    <HiOutlineCloudArrowUp className="dropzone-icon" />
                    <p className="dropzone-title">Drag &amp; drop your ZIP here</p>
                    <p className="dropzone-subtitle">or click to browse — up to {MAX_ZIP_MB}MB</p>
                  </>
                )}
              </div>
            ) : (
              <div className="url-field">
                <HiOutlineLink className="url-field-icon" />
                <input
                  type="text"
                  placeholder="https://github.com/user/repository"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setError(""); }}
                />
              </div>
            )}

            {error && (
              <div className="upload-error">
                <HiOutlineExclamationTriangle /> {error}
              </div>
            )}

            <button className="btn btn-primary upload-submit" onClick={handleSubmit}>
              Analyze repository <HiArrowRight />
            </button>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}
