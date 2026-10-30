import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  PiArrowRight,
  PiShieldWarning,
  PiGauge,
  PiGraph,
  PiBroom,
  PiBookOpenText,
  PiFileMagnifyingGlass,
  PiUploadSimple,
  PiScan,
  PiListChecks,
  PiLockKey,
} from "react-icons/pi";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ScoreGauge from "../components/ScoreGauge";
import SeverityTag from "../components/SeverityTag";
import LanguageBar from "../components/LanguageBar";
import DependencyGraph from "../components/DependencyGraph";
import useRobotsMeta from "../hooks/useRobotsMeta";
import "./Landing.css";

// Example data for the product preview. Rendered with the same components
// the real dashboard uses, and labeled as an example.
const SAMPLE_FINDINGS = [
  { severity: "high", description: "Possible hard-coded credential or secret.", file: "config/settings.py" },
  { severity: "medium", description: "subprocess call with shell=True.", file: "scripts/deploy.py" },
  { severity: "low", description: "Uses print() instead of logging.", file: "ledger/cli.py" },
];
const SAMPLE_LANGS = { Python: 41, SQL: 9, Markdown: 6, YAML: 3 };
const SAMPLE_GRAPH = {
  nodes: [
    { id: "ledger/api.py", label: "api.py", folder: "ledger" },
    { id: "ledger/models.py", label: "models.py", folder: "ledger" },
    { id: "ledger/db.py", label: "db.py", folder: "ledger" },
    { id: "ledger/cli.py", label: "cli.py", folder: "ledger" },
    { id: "config/settings.py", label: "settings.py", folder: "config" },
    { id: "tests/test_api.py", label: "test_api.py", folder: "tests" },
  ],
  edges: [
    { source: "ledger/api.py", target: "ledger/models.py" },
    { source: "ledger/models.py", target: "ledger/db.py" },
    { source: "ledger/db.py", target: "config/settings.py" },
    { source: "ledger/cli.py", target: "ledger/api.py" },
    { source: "tests/test_api.py", target: "ledger/api.py" },
    { source: "ledger/api.py", target: "config/settings.py" },
  ],
  cycles: [],
};

const SECURITY_RULES = [
  "Hard-coded secrets, AWS keys, private keys",
  "SQL built with string formatting",
  "TLS verification turned off",
  "eval / exec, shell=True, unsafe pickle and YAML",
  "innerHTML and document.write",
];
const QUALITY_RULES = ["Files over 400 lines", "Functions over 80 lines", "Deep nesting", "Bare except", "Leftover debug output", "TODO and FIXME"];

const rise = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] } }),
};

function Reveal({ children, className, i = 0 }) {
  return (
    <motion.div className={className} variants={rise} custom={i} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.25 }}>
      {children}
    </motion.div>
  );
}

export default function Landing() {
  useRobotsMeta(false);

  return (
    <>
      <Navbar />
      <main id="main" className="page landing">
        <section className="hero container">
          <div className="hero-copy">
            <motion.h1 variants={rise} custom={0} initial="hidden" animate="show">
              A senior-level code review of any repository.
            </motion.h1>
            <motion.p className="hero-sub" variants={rise} custom={1} initial="hidden" animate="show">
              Upload a ZIP or paste a GitHub URL. Get security findings, a maintainability score, and a dependency map.
            </motion.p>
            <motion.div className="hero-actions" variants={rise} custom={2} initial="hidden" animate="show">
              <Link to="/upload" className="btn btn-primary btn-lg">
                Analyze a repo <PiArrowRight />
              </Link>
              <a href="#checks" className="btn btn-secondary btn-lg">
                See what it checks
              </a>
            </motion.div>
          </div>

          <motion.figure className="preview panel" variants={rise} custom={2} initial="hidden" animate="show">
            <figcaption className="preview-head">
              <span className="mono">ledger-api</span>
              <span className="preview-label">Example report</span>
            </figcaption>
            <div className="preview-top">
              <ScoreGauge score={68} size={150} />
              <div className="preview-stats">
                <dl>
                  <div>
                    <dt>Files</dt>
                    <dd className="mono">59</dd>
                  </div>
                  <div>
                    <dt>Lines</dt>
                    <dd className="mono">7,412</dd>
                  </div>
                  <div>
                    <dt>Findings</dt>
                    <dd className="mono">11</dd>
                  </div>
                </dl>
                <LanguageBar breakdown={SAMPLE_LANGS} />
              </div>
            </div>
            <ul className="preview-findings">
              {SAMPLE_FINDINGS.map((f) => (
                <li key={f.file}>
                  <SeverityTag severity={f.severity} />
                  <div>
                    <p>{f.description}</p>
                    <p className="mono preview-file">{f.file}</p>
                  </div>
                </li>
              ))}
            </ul>
          </motion.figure>
        </section>

        <section id="checks" className="checks container">
          <Reveal>
            <h2 className="section-title">What it checks</h2>
          </Reveal>

          <div className="bento">
            <Reveal className="cell cell-security" i={0}>
              <PiShieldWarning className="cell-icon" />
              <h3>Security</h3>
              <p>Pattern checks across every file for the mistakes that become incidents.</p>
              <ul className="rule-list mono">
                {SECURITY_RULES.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Reveal>

            <Reveal className="cell cell-score" i={1}>
              <PiGauge className="cell-icon" />
              <h3>A score you can audit</h3>
              <p>No black box. Every point comes from a finding you can see.</p>
              <code className="formula">
                100 - 12 x high
                <br />
                {"    "}- 5 x medium
                <br />
                {"    "}- 1.5 x low
              </code>
            </Reveal>

            <Reveal className="cell cell-graph" i={0}>
              <div className="cell-text">
                <PiGraph className="cell-icon" />
                <h3>Dependency map</h3>
                <p>See which files import which, and spot circular imports. Click a file to open its explanation.</p>
              </div>
              <DependencyGraph graph={SAMPLE_GRAPH} height={300} />
            </Reveal>

            <Reveal className="cell cell-quality" i={1}>
              <PiBroom className="cell-icon" />
              <h3>Code quality</h3>
              <p>Structural signals that make code harder to change.</p>
              <ul className="chip-list">
                {QUALITY_RULES.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Reveal>

            <Reveal className="cell cell-docs" i={0}>
              <PiBookOpenText className="cell-icon" />
              <h3>Documentation</h3>
              <p>Missing READMEs and undocumented functions, judged against the kind of project it is.</p>
            </Reveal>

            <Reveal className="cell cell-explain" i={1}>
              <PiFileMagnifyingGlass className="cell-icon" />
              <h3>File explainer</h3>
              <p>Open any file for a plain-language summary of its purpose, logic, and flow, plus specific improvements.</p>
              <blockquote className="explain-sample">
                <span className="mono">ledger/db.py</span>
                Opens the database connection and exposes the session used by every model. Reads credentials from
                settings.py.
              </blockquote>
            </Reveal>
          </div>
        </section>

        <section className="how container">
          <Reveal>
            <h2 className="section-title">How it works</h2>
          </Reveal>
          <ol className="steps">
            {[
              { icon: PiUploadSimple, title: "Upload", text: "Drop a ZIP up to 50 MB, or paste the URL of a public GitHub repository." },
              { icon: PiScan, title: "Scan", text: "A static analysis engine reads every supported file and records each finding." },
              { icon: PiListChecks, title: "Review", text: "Read the dashboard, filter findings, and download the report as PDF or Markdown." },
            ].map((s, i) => (
              <motion.li
                key={s.title}
                className="step"
                variants={rise}
                custom={i}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.25 }}
              >
                <s.icon className="step-icon" />
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </motion.li>
            ))}
          </ol>
          <Reveal className="privacy">
            <PiLockKey className="privacy-icon" />
            <p>
              Whole-repo analysis never sends your source code to an AI model; at most a short summary of findings is
              sent to write the report prose. The file explainer sends only the file you open.
            </p>
          </Reveal>
        </section>

        <section className="container">
          <Reveal className="closing">
            <h2>Find out what's in your repository.</h2>
            <Link to="/upload" className="btn btn-primary btn-lg">
              Analyze a repo <PiArrowRight />
            </Link>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
