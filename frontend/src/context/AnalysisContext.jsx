import { createContext, useContext, useMemo, useState } from "react";

const AnalysisContext = createContext(null);

export function AnalysisProvider({ children }) {
  const [session, setSession] = useState(null); // { id, analysis }
  const [pendingRequest, setPendingRequest] = useState(null); // { mode: 'zip'|'github', file?, url? }

  const value = useMemo(
    () => ({ session, setSession, pendingRequest, setPendingRequest }),
    [session, pendingRequest]
  );

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysisContext() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) {
    throw new Error("useAnalysisContext must be used inside AnalysisProvider");
  }
  return ctx;
}
