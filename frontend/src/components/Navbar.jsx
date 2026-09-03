import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { HiShieldCheck, HiBars3, HiXMark } from "react-icons/hi2";
import "./Navbar.css";

export default function Navbar() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const toggleRef = useRef(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        toggleRef.current &&
        !toggleRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const isActive = (path) => location.pathname === path;

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand">
          <span className="navbar-brand-icon">
            <HiShieldCheck />
          </span>
          <span>
            CodeGuardian <span className="gradient-text">AI</span>
          </span>
        </Link>

        <nav className="navbar-links" aria-label="Primary">
          <Link to="/" className={isActive("/") ? "active" : ""}>
            Home
          </Link>
          <Link to="/upload" className={isActive("/upload") ? "active" : ""}>
            Analyze a repo
          </Link>
        </nav>

        <Link to="/upload" className="btn btn-primary navbar-cta">
          Get started
        </Link>

        <button
          ref={toggleRef}
          className="navbar-menu-toggle"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="navbar-mobile-menu"
        >
          {menuOpen ? <HiXMark /> : <HiBars3 />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            id="navbar-mobile-menu"
            ref={menuRef}
            className="navbar-mobile-menu"
            aria-label="Mobile"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Link to="/" className={isActive("/") ? "active" : ""}>
              Home
            </Link>
            <Link to="/upload" className={isActive("/upload") ? "active" : ""}>
              Analyze a repo
            </Link>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
