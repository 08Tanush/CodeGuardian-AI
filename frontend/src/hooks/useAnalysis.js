import { useEffect, useState } from "react";
import { useAnalysisContext } from "../context/AnalysisContext";
import { getAnalysis } from "../services/api";

/**
 * Returns the analysis for `id`, using the in-memory session when it
 * matches (straight after an upload) and fetching it otherwise (a reload
 * or a shared link).
 */
export default function useAnalysis(id) {
  const { session, setSession } = useAnalysisContext();
  const cached = session?.id === id ? session.analysis : null;
  const [failure, setFailure] = useState({ id: null, message: "" });

  useEffect(() => {
    if (cached) return undefined;
    let cancelled = false;
    getAnalysis(id)
      .then((data) => !cancelled && setSession({ id, analysis: data.analysis }))
      .catch((err) => !cancelled && setFailure({ id, message: err.message }));
    return () => {
      cancelled = true;
    };
  }, [id, cached, setSession]);

  const error = failure.id === id ? failure.message : "";
  return { analysis: cached, loading: !cached && !error, error };
}
