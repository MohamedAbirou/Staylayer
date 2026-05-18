import { useCallback, useEffect, useState, type ReactNode } from "react";
import { OperatorAuthContext } from "./AuthContext";
import { setAccessToken } from "../api/client";
import type { OperatorSession } from "./types";

// Phase 1 scaffolding only. No real network auth calls are made yet.
// Phase 2 will replace these placeholders with `/operator/auth/login`,
// `/operator/auth/refresh`, `/operator/auth/logout`, `/operator/auth/session`.
//
// The provider intentionally exposes a stable shape so feature code written
// in Phase 1 (route guards, layout, permission hooks) does not change in
// Phase 2 when the wire protocol is added.
export function OperatorAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<OperatorSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Placeholder bootstrap: there is no operator session endpoint yet.
    // Phase 2 will call GET /operator/auth/session here and hydrate state.
    setLoading(false);
  }, []);

  const login = useCallback(async (): Promise<OperatorSession> => {
    throw new Error(
      "Operator login is not implemented yet. It will be added in Phase 2.",
    );
  }, []);

  const logout = useCallback(async () => {
    setAccessToken(null);
    setSession(null);
  }, []);

  const refresh = useCallback(async () => {
    return session;
  }, [session]);

  return (
    <OperatorAuthContext.Provider
      value={{ session, loading, login, logout, refresh }}
    >
      {children}
    </OperatorAuthContext.Provider>
  );
}
