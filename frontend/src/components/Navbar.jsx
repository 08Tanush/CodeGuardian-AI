import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { PiShieldCheckFill, PiSun, PiMoon } from "react-icons/pi";
import "./Navbar.css";

function currentTheme() {
  const set = document.documentElement.getAttribute("data-theme");
  if (set) return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme);
  const next = theme === "dark" ? "light" : "dark";

  const toggle = () => {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("cg-theme", next);
    } catch {
      // Storage can be blocked (private mode); the toggle still works for this visit.
    }
    setTheme(next);
  };

  return (
    <button className="btn btn-quiet theme-toggle" onClick={toggle} aria-label={`Switch to ${next} theme`}>
      {theme === "dark" ? <PiSun /> : <PiMoon />}
    </button>
  );
}

export default function Navbar() {
  return (
    <header className="navbar">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="container navbar-inner">
        <Link to="/" className="brand" aria-label="CodeGuardian AI home">
          <PiShieldCheckFill className="brand-mark" />
          <span>
            CodeGuardian <span className="brand-ai">AI</span>
          </span>
        </Link>

        <nav className="navbar-links" aria-label="Primary">
          <NavLink to="/" end className="navbar-link">
            Home
          </NavLink>
          <ThemeToggle />
          <Link to="/upload" className="btn btn-primary navbar-cta">
            Analyze a repo
          </Link>
        </nav>
      </div>
    </header>
  );
}
