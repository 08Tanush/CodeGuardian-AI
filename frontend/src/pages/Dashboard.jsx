import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  HiOutlineDocumentText,
  HiOutlineFolderOpen,
  HiOutlineCodeBracket,
  HiOutlineCube,
  HiOutlineShieldExclamation,
  HiOutlineDocumentMagnifyingGlass,
  HiOutlineSparkles,
  HiArrowRight,
  HiOutlineArrowDownTray,
} from "react-icons/hi2";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ScoreGauge from "../components/ScoreGauge";
import IssueBarChart from "../components/IssueBarChart";
import LanguageDonut from "../components/LanguageDonut";
import DependencyGraph from "../components/DependencyGraph";
import { useAnalysisContext } from "../context/AnalysisContext";
import { getAnalysis, reportDownloadUrl } from "../services/api";
import usePageTitle from "../hooks/usePageTitle";
import "./Dashboard.css";

const SUMMARY_CARDS = [
  { key: "security_analysis", title: "Security", icon: <HiOutlineShieldExclamation />, accent: "danger" },
  { key: "documentation_analysis", title: "Documentation", icon: <HiOutlineDocumentMagnifyingGlass />, accent: "secondary" },
  { key: "code_quality", title: "Code quality", icon: <HiOutlineCodeBracket />, accent: "primary" },
];

export default function Dashboard() {
  usePageTitle("Repository Analysis");
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, setSession } = useAnalysisContext();
  const [analysis, setAnalysis] = useState(session?.id === id ? session.analysis : null);
  const [loading, setLoading] = useState(!analysis);
  const [error, setError] = useState("");

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

  if (loading) {
    return (
      <main className="dashboard-status page">
        <p>Loading analysis…</p>
      </main>
    );
  }

  if (error || !analysis) {
    return (
      <main className="dashboard-status page">
        <p>{error || "That analysis couldn't be found."}</p>
        <button className="btn btn-primary" onClick={() => navigate("/upload")}>
          Start a new analysis
        </button>
      </main>
    );
  }

  const repo = analysis.repository;

  return (
    <>
      <Navbar />
      <main className="page dashboard">
        <div className="container">
          <motion.div
            className="dashboard-header"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div>
              <span className="section-eyebrow">Analysis complete</span>
              <h1>{repo.name}</h1>
              {analysis.analysis_mode === "heuristic" && (
                <p className="dashboard-mode-note">
                  Generated in heuristic mode — set <code>GROQ_API_KEY</code> on the backend for full AI analysis.
                </p>
              )}
            </div>
            <div className="dashboard-header-actions">
              <Link to={`/report/${id}`} className="btn btn-ghost">
                View full report <HiArrowRight />
              </Link>
              <a href={reportDownloadUrl(id)} className="btn btn-primary" download>
                <HiOutlineArrowDownTray /> Download .md
              </a>
            </div>
          </motion.div>

          <div className="dashboard-grid">
            <motion.section
              className="dashboard-card score-card"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
            >
              <ScoreGauge score={analysis.maintainability_score} />
            </motion.section>

            <motion.section
              className="dashboard-card repo-info-card"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
            >
              <h3>Repository information</h3>
              <div className="repo-info-body">
                <div className="repo-info-grid">
                  <InfoItem icon={<HiOutlineFolderOpen />} label="Size" value={repo.total_size_display} />
                  <InfoItem icon={<HiOutlineCodeBracket />} label="Primary language" value={repo.primary_language} />
                  <InfoItem icon={<HiOutlineCube />} label="Framework" value={repo.framework} />
                  <InfoItem icon={<HiOutlineDocumentText />} label="Files analyzed" value={repo.file_count} />
                  <InfoItem icon={<HiOutlineDocumentText />} label="Lines of code" value={repo.total_lines} />
                </div>
                <LanguageDonut breakdown={repo.language_breakdown} />
              </div>
              <p className="repo-summary">{analysis.summary}</p>
            </motion.section>

            <motion.section
              className="dashboard-card full-width-card"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.15 }}
            >
              <h3>Issue distribution</h3>
              <IssueBarChart distribution={analysis.issue_distribution} />
            </motion.section>

            <motion.section
              className="dashboard-card architecture-card"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 }}
            >
              <div className="architecture-card-header">
                <div>
                  <h3>Architecture map</h3>
                  <p className="architecture-card-subtitle">
                    How files import and depend on each other, mapped automatically from the code.
                  </p>
                </div>
                <Link to={`/report/${id}#architecture`} className="btn btn-ghost architecture-card-link">
                  Explore file by file <HiArrowRight />
                </Link>
              </div>
              <DependencyGraph
                graph={analysis.dependency_graph}
                height={340}
                onFileClick={() => navigate(`/report/${id}`)}
              />
            </motion.section>

            {SUMMARY_CARDS.map((card, i) => (
              <motion.section
                key={card.key}
                className={`dashboard-card summary-card accent-${card.accent}`}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.18 + i * 0.05 }}
                whileHover={{ y: -4 }}
              >
                <div className="summary-card-icon">{card.icon}</div>
                <h4>{card.title}</h4>
                <p>{analysis[card.key]}</p>
              </motion.section>
            ))}

            <motion.section
              className="dashboard-card suggestions-card"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.4 }}
            >
              <div className="summary-card-icon accent-icon-primary">
                <HiOutlineSparkles />
              </div>
              <h4>AI suggestions</h4>
              {analysis.ai_suggestions.length > 0 ? (
                <ul>
                  {analysis.ai_suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="empty-state-note">No specific suggestions for this repository right now.</p>
              )}
            </motion.section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <div className="info-item">
      <span className="info-item-icon">{icon}</span>
      <div>
        <p className="info-item-label">{label}</p>
        <p className="info-item-value">{value}</p>
      </div>
    </div>
  );
}
