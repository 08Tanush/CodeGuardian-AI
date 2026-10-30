import { Link } from "react-router-dom";
import { PiShieldCheckFill } from "react-icons/pi";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <Link to="/" className="footer-brand">
          <PiShieldCheckFill /> CodeGuardian AI
        </Link>
        <p className="footer-note">
          Repositories are kept in temporary storage on the analysis server. Whole-repo analysis never sends
          source code to an AI model.
        </p>
      </div>
    </footer>
  );
}
