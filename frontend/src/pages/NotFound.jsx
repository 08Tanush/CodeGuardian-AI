import { Link } from "react-router-dom";
import { HiOutlineFaceFrown, HiArrowRight } from "react-icons/hi2";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import "./NotFound.css";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="page not-found">
        <div className="container not-found-inner">
          <HiOutlineFaceFrown className="not-found-icon" />
          <h1>404</h1>
          <p>This page doesn't exist. It may have been moved, or the link might be broken.</p>
          <Link to="/" className="btn btn-primary">
            Back to home <HiArrowRight />
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
