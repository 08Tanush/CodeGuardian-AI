import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { PiArrowRight, PiDownloadSimple, PiFilePdf, PiSparkle, PiShieldWarning, PiBroom, PiBookOpenText } from "react-icons/pi";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ScoreGauge from "../components/ScoreGauge";
import SeverityBreakdown from "../components/SeverityBreakdown";
import LanguageBar from "../components/LanguageBar";
import DependencyGraph from "../components/DependencyGraph";
import FindingsList from "../components/FindingsList";
import { PageSkeleton, PageError } from "../components/PageStatus";
import { reportDownloadUrl, reportPdfDownloadUrl } from "../services/api";
import useAnalysis from "../hooks/useAnalysis";
import usePageTitle from "../hooks/usePageTitle";
import useRobotsMeta from "../hooks/useRobotsMeta";
import "./Dashboard.css";

const fmt = new Intl.NumberFormat("en-US");

function formatRepoType(type) {
  if (!type || type === "unknown") return "Unclassified";
  const s = type.replace(/_/g, " ").replace(/\b(cli|ml)\b/g, (m) => m.toUpperCase());
  return s[0].toUpperCase() + s.slice(1);
}

const NOTES = [
  { key: "security_analysis", title: "Security", icon: PiShieldWarning },
  { key: "code_quality", title: "Code quality", icon: PiBroom },
  { key: "documentation_analysis", title: "Documentation", icon: PiBookOpenText },
];

function Panel({ className = "", children, i = 0 }) {
  return (
    <motion.section
      className={`panel dash-panel ${className}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.04 * i, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.section>
  );
}

export default function Dashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { analysis, loading, error } = useAnalysis(id);
  usePageTitle(analysis ? analysis.repository.name : "Repository analysis");
  useRobotsMeta(true);

  if (loading) return <PageSkeleton />;
  if (error || !analysis) return <PageError message={error} />;

  const repo = analysis.repository;
  const issues = analysis.issues || [];
  const sevCount = (s) => issues.filter((i) => i.severity === s).length;
  const ds = analysis.discovery_stats;
  const perFile = {};
  issues.forEach((i) => {
    if (i.file && i.file !== "/") perFile[i.file] = (perFile[i.file] || 0) + 1;
  });
  const hotFiles = Object.entries(perFile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const openFile = (path) => navigate(`/report/${id}?file=${encodeURIComponent(path)}#files`);

  return (
    <>
      <Navbar />
      <main id="main" className="page dashboard">
        <div className="container">
          <header className="dash-head">
            <div className="dash-title">
              <h1 className="mono">{repo.name}</h1>
              <ul className="dash-meta">
                <li>{formatRepoType(repo.repository_type)}</li>
                <li>{repo.primary_language}</li>
                {repo.framework && repo.framework !== "Not detected" && <li>{repo.framework}</li>}
                <li className={`mode-badge ${analysis.analysis_mode === "ai" ? "ai" : ""}`}>
                  {analysis.analysis_mode === "ai" ? (
                    <>
                      <PiSparkle /> AI-assisted
                    </>
                  ) : (
                    "Static analysis"
                  )}
                </li>
              </ul>
            </div>
            <div className="dash-actions">
              <Link to={`/report/${id}`} className="btn btn-secondary">
                Full report <PiArrowRight />
              </Link>
              <a href={reportDownloadUrl(id)} className="btn btn-secondary" download>
                <PiDownloadSimple /> Markdown
              </a>
              <a href={reportPdfDownloadUrl(id)} className="btn btn-primary" download>
                <PiFilePdf /> PDF
              </a>
            </div>
          </header>

          <div className="dash-grid">
            <Panel className="score-panel" i={0}>
              <h2 className="panel-title">Maintainability</h2>
              <ScoreGauge score={analysis.maintainability_score} />
              <dl className="sev-counts">
                {["high", "medium", "low"].map((s) => (
                  <div key={s}>
                    <dt className={`sev-dt sev-text-${s}`}>{s[0].toUpperCase() + s.slice(1)}</dt>
                    <dd className="mono">{sevCount(s)}</dd>
                  </div>
                ))}
              </dl>
            </Panel>

            <Panel className="overview-panel" i={1}>
              <h2 className="panel-title">Overview</h2>
              <dl className="stat-row">
                <div>
                  <dt>Files analyzed</dt>
                  <dd className="mono">{fmt.format(repo.file_count)}</dd>
                </div>
                <div>
                  <dt>Lines of code</dt>
                  <dd className="mono">{fmt.format(repo.total_lines)}</dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd className="mono">{repo.total_size_display}</dd>
                </div>
                <div>
                  <dt>Findings</dt>
                  <dd className="mono">{fmt.format(issues.length)}</dd>
                </div>
              </dl>
              <div className="overview-langs">
                <h3 className="panel-sub">Files by language</h3>
                <LanguageBar breakdown={repo.language_breakdown} />
              </div>
              <p className="overview-summary">{analysis.summary}</p>
              {ds?.files_skipped > 0 && (
                <p className="discovery-note">
                  {fmt.format(ds.files_discovered)} files found, {fmt.format(ds.files_analyzed)} read.{" "}
                  {[
                    ds.skip_reasons.unsupported_extension > 0 && `${ds.skip_reasons.unsupported_extension} unsupported type`,
                    ds.skip_reasons.unreadable_or_binary > 0 && `${ds.skip_reasons.unreadable_or_binary} binary or unreadable`,
                    ds.skip_reasons.lock_file > 0 && `${ds.skip_reasons.lock_file} lock files`,
                    ds.skip_reasons.size_limit > 0 && `${ds.skip_reasons.size_limit} over the size limit`,
                  ]
                    .filter(Boolean)
                    .join(", ")}{" "}
                  skipped.
                </p>
              )}
            </Panel>

            <Panel className="breakdown-panel" i={2}>
              <h2 className="panel-title">Findings by category</h2>
              <p className="panel-sub">Bar length is the number of findings; segments split by severity.</p>
              <div className="panel-body">
                <SeverityBreakdown issues={issues} />
              </div>
              {hotFiles.length > 0 && (
                <div className="hot-files">
                  <h3 className="panel-sub">Files with the most findings</h3>
                  <ol>
                    {hotFiles.map(([file, n]) => (
                      <li key={file}>
                        <button className="hot-file mono" onClick={() => openFile(file)} title={file}>
                          {file.split("/").length > 2 ? `.../${file.split("/").slice(-2).join("/")}` : file}
                        </button>
                        <span className="mono hot-count">{n}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </Panel>

            <Panel className="top-panel" i={3}>
              <div className="panel-head-row">
                <h2 className="panel-title">Most severe findings</h2>
                {issues.length > 5 && (
                  <Link to={`/report/${id}#findings`} className="text-link">
                    All {issues.length} <PiArrowRight />
                  </Link>
                )}
              </div>
              <div className="panel-body">
                <FindingsList issues={issues} limit={5} filters={false} onFileClick={openFile} />
              </div>
            </Panel>

            <Panel className="graph-panel" i={4}>
              <div className="panel-head-row">
                <div>
                  <h2 className="panel-title">Dependency map</h2>
                  <p className="panel-sub">Which files import which. Select a file to open its explanation.</p>
                </div>
              </div>
              <div className="panel-body">
                <DependencyGraph graph={analysis.dependency_graph} height={420} onFileClick={openFile} />
              </div>
            </Panel>

            <Panel className="notes-panel" i={5}>
              <h2 className="panel-title">Assessment</h2>
              <div className="notes">
                {NOTES.map(({ key, title, icon: Icon }) => (
                  <section key={key} className="note">
                    <h3>
                      <Icon /> {title}
                    </h3>
                    <p>{analysis[key]}</p>
                  </section>
                ))}
              </div>
            </Panel>

            <Panel className="suggest-panel" i={6}>
              <h2 className="panel-title">Suggestions</h2>
              {analysis.ai_suggestions.length > 0 ? (
                <ol className="numbered">
                  {analysis.ai_suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              ) : (
                <p className="empty-note">No specific suggestions for this repository.</p>
              )}
            </Panel>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
