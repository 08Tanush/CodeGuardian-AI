import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  HiOutlineDocumentText,
  HiOutlineCubeTransparent,
  HiOutlineShieldExclamation,
  HiOutlineCodeBracket,
  HiOutlineDocumentMagnifyingGlass,
  HiOutlineSparkles,
  HiOutlineMap,
  HiOutlineArrowDownTray,
  HiOutlineFolderOpen,
} from "react-icons/hi2";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import CollapsibleSection from "../components/CollapsibleSection";
import FileExplorer from "../components/FileExplorer";
import FileExplainerPanel from "../components/FileExplainerPanel";
import DependencyGraph from "../components/DependencyGraph";
import { useAnalysisContext } from "../context/AnalysisContext";
import { getAnalysis, explainFile, reportDownloadUrl } from "../services/api";
import usePageTitle from "../hooks/usePageTitle";
import "./Report.css";

export default function Report() {
  usePageTitle("Engineering Report");
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, setSession } = useAnalysisContext();
  const [analysis, setAnalysis] = useState(session?.id === id ? session.analysis : null);
  const [loading, setLoading] = useState(!analysis);
  const [error, setError] = useState("");

  const [activePath, setActivePath] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState("");
  const explainerRef = useRef(null);

  useEffect(() => {
    if (session?.id === id) {
      setAnalysis(session.analysis);
      setLoading(false);
      return;
    }
    setLoading(true);
    getAnalysis(id)
      .then((data) => {
        setAnalysis(data.analysis);
        setSession({ id, analysis: data.analysis });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && location.hash === "#architecture") {
      requestAnimationFrame(() => {
        document.getElementById("architecture")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [loading, location.hash]);

  const handleFileClick = async (path) => {
    setActivePath(path);
    setExplanation(null);
    setExplainError("");
    setExplainLoading(true);
    explainerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const data = await explainFile(id, path);
      setExplanation(data);
    } catch (err) {
      setExplainError(err.message);
    } finally {
      setExplainLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="report-status page">
        <p>Loading report…</p>
      </main>
    );
  }

  if (error || !analysis) {
    return (
      <main className="report-status page">
        <p>{error || "That report couldn't be found."}</p>
        <button className="btn btn-primary" onClick={() => navigate("/upload")}>
          Start a new analysis
        </button>
      </main>
    );
  }

  return (
    <>
      <Navbar />
      <main className="page report-page">
        <div className="container">
          <motion.div
            className="report-header"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div>
              <span className="section-eyebrow">Detailed engineering report</span>
              <h1>{analysis.repository.name}</h1>
            </div>
            <a href={reportDownloadUrl(id)} className="btn btn-primary" download>
              <HiOutlineArrowDownTray /> Download markdown report
            </a>
          </motion.div>

          <div className="report-sections">
            <CollapsibleSection icon={<HiOutlineDocumentText />} title="Repository Overview" defaultOpen>
              <p>{analysis.summary}</p>
            </CollapsibleSection>

            <div id="architecture">
              <CollapsibleSection icon={<HiOutlineCubeTransparent />} title="Architecture Review" defaultOpen>
                <p>{analysis.architecture_overview}</p>
                <div className="architecture-graph-wrap">
                  <DependencyGraph graph={analysis.dependency_graph} onFileClick={handleFileClick} />
                </div>
              </CollapsibleSection>
            </div>

            <CollapsibleSection
              icon={<HiOutlineShieldExclamation />}
              title="Security Analysis"
              badge={analysis.issue_distribution.security || 0}
            >
              <p>{analysis.security_analysis}</p>
              <IssueList issues={analysis.issues} category="security" />
            </CollapsibleSection>

            <CollapsibleSection
              icon={<HiOutlineCodeBracket />}
              title="Code Quality"
              badge={analysis.issue_distribution.quality || 0}
            >
              <p>{analysis.code_quality}</p>
              <IssueList issues={analysis.issues} category="quality" />
            </CollapsibleSection>

            <CollapsibleSection
              icon={<HiOutlineDocumentMagnifyingGlass />}
              title="Documentation"
              badge={analysis.issue_distribution.documentation || 0}
            >
              <p>{analysis.documentation_analysis}</p>
              <IssueList issues={analysis.issues} category="documentation" />
            </CollapsibleSection>

            <CollapsibleSection icon={<HiOutlineSparkles />} title="AI Suggestions">
              {analysis.ai_suggestions.length > 0 ? (
                <ul>
                  {analysis.ai_suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="empty-state-note">No specific suggestions for this repository right now.</p>
              )}
            </CollapsibleSection>

            <CollapsibleSection icon={<HiOutlineMap />} title="Improvement Roadmap">
              {analysis.improvement_roadmap.length > 0 ? (
                <ul>
                  {analysis.improvement_roadmap.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="empty-state-note">Nothing to prioritize - no significant issues were found.</p>
              )}
            </CollapsibleSection>
          </div>

          <motion.div
            className="file-explainer-section"
            ref={explainerRef}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
          >
            <div className="section-heading file-explainer-heading">
              <span className="section-eyebrow">Explore the code</span>
              <h2>File Explainer</h2>
              <p>Click any file to get an AI explanation of its purpose, logic, flow, and possible improvements.</p>
            </div>

            <div className="file-explainer-grid">
              <div className="file-explainer-tree">
                <div className="file-explainer-tree-header">
                  <HiOutlineFolderOpen /> Repository files
                </div>
                <FileExplorer tree={analysis.file_tree} onFileClick={handleFileClick} activePath={activePath} />
              </div>
              <FileExplainerPanel
                path={activePath}
                loading={explainLoading}
                error={explainError}
                explanation={explanation}
              />
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function IssueList({ issues, category }) {
  const filtered = issues.filter((i) => i.category === category);
  if (filtered.length === 0) return null;
  return (
    <ul className="report-issue-list">
      {filtered.map((issue, i) => (
        <li key={i}>
          <span className={`severity-tag severity-${issue.severity}`}>{issue.severity}</span>
          <code>{issue.file}</code> — {issue.description}
        </li>
      ))}
    </ul>
  );
}
