import { Routes, Route } from "react-router-dom";
import { AnalysisProvider } from "./context/AnalysisContext";
import Landing from "./pages/Landing";
import Upload from "./pages/Upload";
import Loading from "./pages/Loading";
import Dashboard from "./pages/Dashboard";
import Report from "./pages/Report";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <AnalysisProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/analyzing" element={<Loading />} />
        <Route path="/dashboard/:id" element={<Dashboard />} />
        <Route path="/report/:id" element={<Report />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnalysisProvider>
  );
}
