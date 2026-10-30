import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import usePageTitle from "../hooks/usePageTitle";
import useRobotsMeta from "../hooks/useRobotsMeta";
import "./NotFound.css";

export default function NotFound() {
  usePageTitle("Page not found");
  useRobotsMeta(true);

  return (
    <>
      <Navbar />
      <main id="main" className="page status-screen">
        <div className="status-screen-inner">
          <p className="nf-code mono">404</p>
          <h1 className="nf-title">This page doesn't exist</h1>
          <p>The link may be broken, or the page may have moved.</p>
          <div className="nf-actions">
            <Link to="/" className="btn btn-secondary">
              Home
            </Link>
            <Link to="/upload" className="btn btn-primary">
              Analyze a repo
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
