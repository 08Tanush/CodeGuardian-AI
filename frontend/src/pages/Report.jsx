import { useEffect, useRef, useState } from "react";
import { useParams, useLocation, useSearchParams, Link } from "react-router-dom";
import { PiArrowLeft, PiDownloadSimple, PiFilePdf, PiCheckCircle } from "react-icons/pi";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import FindingsList from "../components/FindingsList";
import FileExplorer from "../components/FileExplorer";
import FileExplainerPanel from "../components/FileExplainerPanel";
import DependencyGraph from "../components/DependencyGraph";
import ScoreGauge from "../components/ScoreGauge";
import { PageSkeleton, PageError } from "../components/PageStatus";
import { explainFile, reportDownloadUrl, reportPdfDownloadUrl } from "../services/api";
import useAnalysis from "../hooks/useAnalysis";
import usePageTitle from "../hooks/usePageTitle";
import useRobotsMeta from "../hooks/useRobotsMeta";
import "./Report.css";

const SECTIONS = [
  ["overview", "Overview"],
  ["architecture", "Architecture"],
  ["findings", "Findings"],
  ["assessment", "Assessment"],
  ["suggestions", "Suggestions"],
  ["roadmap", "Roadmap"],
  ["strengths", "Strengths"],
  ["files", "File explainer"],
];

function List({ items, empty, ordered }) {
  if (!items?.length) return <p className="empty-note">{empty}</p>;
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={ordered ? "numbered" : "report-bullets"}>
      {items.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </Tag>
  );
}

export default function Report() {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { analysis, loading, error } = useAnalysis(id);
  usePageTitle(analysis ? `Report: ${analysis.repository.name}` : "Engineering report");
  useRobotsMeta(true);

  const [activePath, setActivePath] = useState(() => searchParams.get("file"));
  const [result, setResult] = useState({ path: null, data: null, error: "" });
  const filesRef = useRef(null);

  // Fetch the explanation for whichever file is active. Cancelling the
  // stale request means a slow response for an earlier click can never
  // overwrite the file the user is looking at now.
  useEffect(() => {
    if (!activePath || !analysis) return undefined;
    let cancelled = false;
    explainFile(id, activePath)
      .then((data) => !cancelled && setResult({ path: activePath, data, error: "" }))
      .catch((err) => !cancelled && setResult({ path: activePath, data: null, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [id, activePath, analysis]);

  useEffect(() => {
    if (!analysis || !location.hash) return;
    requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start" }));
  }, [analysis, location.hash]);

  if (loading) return <PageSkeleton />;
  if (error || !analysis) return <PageError message={error} />;

  const openFile = (path) => {
    setActivePath(path);
    setSearchParams({ file: path }, { replace: true, preventScrollReset: true });
    filesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const explainLoading = Boolean(activePath) && result.path !== activePath;
  const repo = analysis.repository;

  return (
    <>
      <Navbar />
      <main id="main" className="page report">
        <div className="container">
          <header className="report-head">
            <div className="report-title">
              <Link to={`/dashboard/${id}`} className="text-link back-link">
                <PiArrowLeft /> Dashboard
              </Link>
              <h1>Engineering report</h1>
              <p className="mono report-repo">{repo.name}</p>
            </div>
            <div className="dash-actions">
              <a href={reportDownloadUrl(id)} className="btn btn-secondary" download>
                <PiDownloadSimple /> Markdown
              </a>
              <a href={reportPdfDownloadUrl(id)} className="btn btn-primary" download>
                <PiFilePdf /> PDF
              </a>
            </div>
          </header>

          <div className="report-layout">
            <nav className="report-toc" aria-label="Report sections">
              <ul>
                {SECTIONS.map(([sid, label]) => (
                  <li key={sid}>
                    <a href={`#${sid}`}>{label}</a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="report-main">
              <section id="overview" className="report-section">
                <h2>Overview</h2>
                <div className="overview-split">
                  <ScoreGauge score={analysis.maintainability_score} size={150} />
                  <div>
                    <p>{analysis.summary}</p>
                    <dl className="kv">
                      <div>
                        <dt>Primary language</dt>
                        <dd>{repo.primary_language}</dd>
                      </div>
                      <div>
                        <dt>Framework</dt>
                        <dd>{repo.framework}</dd>
                      </div>
                      <div>
                        <dt>Files</dt>
                        <dd className="mono">{repo.file_count}</dd>
                      </div>
                      <div>
                        <dt>Lines</dt>
                        <dd className="mono">{repo.total_lines}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </section>

              <section id="architecture" className="report-section">
                <h2>Architecture</h2>
                <p>{analysis.architecture_overview}</p>
                <div className="section-block">
                  <DependencyGraph graph={analysis.dependency_graph} onFileClick={openFile} />
                </div>
              </section>

              <section id="findings" className="report-section">
                <h2>
                  Findings <span className="count mono">{analysis.issues.length}</span>
                </h2>
                <div className="section-block">
                  <FindingsList issues={analysis.issues} onFileClick={openFile} />
                </div>
              </section>

              <section id="assessment" className="report-section">
                <h2>Assessment</h2>
                <dl className="assessment">
                  <div>
                    <dt>Security</dt>
                    <dd>{analysis.security_analysis}</dd>
                  </div>
                  <div>
                    <dt>Code quality</dt>
                    <dd>{analysis.code_quality}</dd>
                  </div>
                  <div>
                    <dt>Documentation</dt>
                    <dd>{analysis.documentation_analysis}</dd>
                  </div>
                </dl>
              </section>

              <section id="suggestions" className="report-section">
                <h2>Suggestions</h2>
                <List items={analysis.ai_suggestions} empty="No specific suggestions for this repository." ordered />
              </section>

              <section id="roadmap" className="report-section">
                <h2>Roadmap</h2>
                <p className="section-lede">The highest-impact fixes, most severe first.</p>
                <List items={analysis.improvement_roadmap} empty="Nothing to prioritize." ordered />
              </section>

              <section id="strengths" className="report-section">
                <h2>Strengths</h2>
                {analysis.strengths?.length ? (
                  <ul className="strengths">
                    {analysis.strengths.map((s, i) => (
                      <li key={i}>
                        <PiCheckCircle /> {s}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-note">No particular strengths were detected.</p>
                )}
              </section>

              <section id="files" className="report-section" ref={filesRef}>
                <h2>File explainer</h2>
                <p className="section-lede">Choose a file to see its purpose, dependencies, and suggested improvements.</p>
                <div className="explorer panel">
                  <div className="explorer-tree">
                    <FileExplorer tree={analysis.file_tree} onFileClick={openFile} activePath={activePath} />
                  </div>
                  <div className="explorer-panel">
                    <FileExplainerPanel
                      path={activePath}
                      loading={explainLoading}
                      error={result.path === activePath ? result.error : ""}
                      explanation={result.path === activePath ? result.data : null}
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
