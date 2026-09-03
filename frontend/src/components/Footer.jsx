import { HiShieldCheck } from "react-icons/hi2";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <span className="footer-brand-icon">
            <HiShieldCheck />
          </span>
          <div>
            <p className="footer-title">CodeGuardian AI</p>
            <p className="footer-tagline">Engineering intelligence for every repository.</p>
          </div>
        </div>

        <div className="footer-meta">
          <span>Built with FastAPI, React &amp; Groq</span>
          <span className="footer-dot">•</span>
          <span>No data leaves your analysis session</span>
        </div>
      </div>
    </footer>
  );
}
