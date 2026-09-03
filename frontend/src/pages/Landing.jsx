import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  HiOutlineCpuChip,
  HiOutlineShieldExclamation,
  HiOutlineBoltSlash,
  HiOutlineDocumentText,
  HiOutlineSparkles,
  HiOutlineCubeTransparent,
  HiArrowRight,
  HiOutlineCloudArrowUp,
} from "react-icons/hi2";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import FeatureCard from "../components/FeatureCard";
import "./Landing.css";

const FEATURES = [
  {
    icon: <HiOutlineCubeTransparent />,
    title: "Architecture overview",
    description: "See how your repository is structured, how modules connect, and where complexity concentrates.",
    accent: "primary",
  },
  {
    icon: <HiOutlineShieldExclamation />,
    title: "Security analysis",
    description: "Surface hard-coded secrets, unsafe patterns, and other risks before they reach production.",
    accent: "danger",
  },
  {
    icon: <HiOutlineBoltSlash />,
    title: "Visual dependency map",
    description: "An interactive graph of how your files import and depend on each other, generated automatically.",
    accent: "warning",
  },
  {
    icon: <HiOutlineDocumentText />,
    title: "Documentation analysis",
    description: "Find out where your README, comments, and docs fall short of what new contributors need.",
    accent: "secondary",
  },
  {
    icon: <HiOutlineCpuChip />,
    title: "Code quality scoring",
    description: "Get a maintainability score built from real findings, not a black-box number.",
    accent: "success",
  },
  {
    icon: <HiOutlineSparkles />,
    title: "AI suggestions",
    description: "Click any file to get an instant AI explanation of its purpose, logic, and possible improvements.",
    accent: "primary",
  },
];

export default function Landing() {
  return (
    <>
      <Navbar />
      <main className="page landing">
        <section className="hero">
          <div className="hero-bg" aria-hidden="true">
            <span className="hero-blob blob-a" />
            <span className="hero-blob blob-b" />
            <span className="hero-grid" />
          </div>

          <div className="container hero-inner">
            <motion.span
              className="hero-eyebrow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <HiOutlineSparkles /> AI-powered engineering intelligence
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 }}
            >
              Point CodeGuardian at your repo.
              <br />
              Get a <span className="gradient-text">senior engineer's review</span> in minutes.
            </motion.h1>

            <motion.p
              className="hero-subtitle"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16 }}
            >
              Upload a ZIP or paste a public GitHub URL. CodeGuardian runs a fast static analysis
              engine across every file, then uses AI to turn the findings into a polished
              engineering report — architecture, security, documentation, and a maintainability
              score, plus an interactive dependency map.
            </motion.p>

            <motion.div
              className="hero-actions"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.24 }}
            >
              <Link to="/upload" className="btn btn-primary hero-cta">
                <HiOutlineCloudArrowUp /> Analyze a repository <HiArrowRight />
              </Link>
              <a href="#features" className="btn btn-ghost">
                See what it checks
              </a>
            </motion.div>

            <motion.div
              className="hero-stats"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.32 }}
            >
              <div>
                <strong>8</strong>
                <span>Report sections</span>
              </div>
              <div className="hero-stats-divider" />
              <div>
                <strong>ZIP or URL</strong>
                <span>Two ways to start</span>
              </div>
              <div className="hero-stats-divider" />
              <div>
                <strong>.md</strong>
                <span>Exportable report</span>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="features" id="features">
          <div className="container">
            <div className="section-heading">
              <span className="section-eyebrow">What CodeGuardian checks</span>
              <h2>Every angle a senior reviewer would look at</h2>
              <p>Six analysis dimensions, distilled into one report you can share, download, or dig into file by file.</p>
            </div>

            <div className="features-grid">
              {FEATURES.map((f, i) => (
                <FeatureCard key={f.title} {...f} index={i} />
              ))}
            </div>
          </div>
        </section>

        <section className="cta-band">
          <div className="container cta-band-inner">
            <div>
              <h2>Ready to see your codebase through CodeGuardian's eyes?</h2>
              <p>No account, no setup — just drop in a repository and get a report.</p>
            </div>
            <Link to="/upload" className="btn btn-primary">
              Get started <HiArrowRight />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
