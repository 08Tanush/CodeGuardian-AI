import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { AnalysisProvider } from "./context/AnalysisContext";
import { PageSkeleton } from "./components/PageStatus";
import Landing from "./pages/Landing";
import Upload from "./pages/Upload";
import Loading from "./pages/Loading";
import NotFound from "./pages/NotFound";

// Result pages are only needed after an analysis, so they load on demand.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Report = lazy(() => import("./pages/Report"));

export default function App() {
  return (
    <AnalysisProvider>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/analyzing" element={<Loading />} />
          <Route path="/dashboard/:id" element={<Dashboard />} />
          <Route path="/report/:id" element={<Report />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AnalysisProvider>
  );
}
