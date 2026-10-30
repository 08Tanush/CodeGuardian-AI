import { Link } from "react-router-dom";
import { PiWarningCircle } from "react-icons/pi";
import Navbar from "./Navbar";
import Footer from "./Footer";

export function PageSkeleton() {
  return (
    <>
      <Navbar />
      <main id="main" className="page" aria-busy="true" aria-label="Loading analysis">
        <div className="container" style={{ display: "grid", gap: 16, paddingTop: 40 }}>
          <div className="skeleton" style={{ height: 34, width: "40%" }} />
          <div className="skeleton" style={{ height: 16, width: "25%" }} />
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: 16 }}>
            <div className="skeleton" style={{ height: 240 }} />
            <div className="skeleton" style={{ height: 240 }} />
          </div>
          <div className="skeleton" style={{ height: 320 }} />
        </div>
      </main>
    </>
  );
}

export function PageError({ message }) {
  return (
    <>
      <Navbar />
      <main id="main" className="page status-screen">
        <div className="status-screen-inner">
          <PiWarningCircle style={{ fontSize: "2rem", color: "var(--sev-high)" }} />
          <h1 style={{ fontSize: "1.4rem" }}>This analysis isn't available</h1>
          <p>{message || "It may have expired."}</p>
          <Link to="/upload" className="btn btn-primary">
            Analyze a repo
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
