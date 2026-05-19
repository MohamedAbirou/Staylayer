import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { OperatorAuthContext } from "./AuthContext";
import {
  OPERATOR_AUTH_EVENTS,
  getAccessToken,
  refreshOperatorSession,
  setAccessToken,
  type OperatorAuthRefreshedDetail,
} from "../api/client";
import {
  fetchOperatorSession,
  operatorLogin,
  operatorLogout,
  operatorMfaVerify,
} from "../api/auth";
import { isMfaChallenge } from "./types";
import type { OperatorSession } from "./types";
import type { OperatorLoginOutcome } from "./AuthContext";

// Refresh the access token a little before it expires so an idle dashboard
// stays signed in across the 15-minute access token lifetime. Backend issues
// tokens with `expiresIn` in seconds; we refresh 60 seconds early.
const REFRESH_LEEWAY_SECONDS = 60;
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export function OperatorAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<OperatorSession | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<number | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const scheduleSilentRefresh = useCallback(
    (ttlSeconds: number) => {
      clearRefreshTimer();
      const delayMs = Math.max(
        15_000,
        (ttlSeconds - REFRESH_LEEWAY_SECONDS) * 1000,
      );
      refreshTimerRef.current = window.setTimeout(() => {
        void refreshOperatorSession();
      }, delayMs);
    },
    [clearRefreshTimer],
  );

  const bootstrap = useCallback(async () => {
    // If we have a cached access token, try to load the session directly.
    if (getAccessToken()) {
      try {
        const { user, permissions } = await fetchOperatorSession();
        setSession({ user, permissions });
        scheduleSilentRefresh(DEFAULT_ACCESS_TOKEN_TTL_SECONDS);
        return;
      } catch {
        // Fall through to refresh attempt; 401 handler in the axios client
        // already cleared the token in that case.
      }
    }

    // No usable access token yet. Try the refresh cookie (httpOnly) — if the
    // operator's previous session is still alive on the backend this returns
    // a new access token without prompting for credentials.
    const refreshed = await refreshOperatorSession();
    if (refreshed) {
      setSession({ user: refreshed.user, permissions: refreshed.permissions });
      scheduleSilentRefresh(refreshed.expiresIn);
    } else {
      setSession(null);
    }
  }, [scheduleSilentRefresh]);

  useEffect(() => {
    void bootstrap().finally(() => setLoading(false));
    return clearRefreshTimer;
  }, [bootstrap, clearRefreshTimer]);

  // Stay in sync with the axios client. The client may rotate tokens or drop
  // the session as a side-effect of any HTTP call, and we want the React
  // tree to reflect that without component-level plumbing.
  useEffect(() => {
    function onRefreshed(event: Event) {
      const detail = (event as CustomEvent<OperatorAuthRefreshedDetail>).detail;
      if (detail?.session) {
        setSession(detail.session);
        scheduleSilentRefresh(DEFAULT_ACCESS_TOKEN_TTL_SECONDS);
      }
    }
    function onUnauthenticated() {
      clearRefreshTimer();
      setSession(null);
    }

    window.addEventListener(OPERATOR_AUTH_EVENTS.refreshed, onRefreshed);
    window.addEventListener(
      OPERATOR_AUTH_EVENTS.unauthenticated,
      onUnauthenticated,
    );
    return () => {
      window.removeEventListener(OPERATOR_AUTH_EVENTS.refreshed, onRefreshed);
      window.removeEventListener(
        OPERATOR_AUTH_EVENTS.unauthenticated,
        onUnauthenticated,
      );
    };
  }, [clearRefreshTimer, scheduleSilentRefresh]);

  const login = useCallback(
    async (email: string, password: string): Promise<OperatorLoginOutcome> => {
      const result = await operatorLogin(email, password);
      if (isMfaChallenge(result)) {
        // Do NOT set any access token or session yet — the caller must
        // post a TOTP/recovery code to /operator/auth/mfa/verify first.
        return {
          kind: "mfa-required",
          challengeToken: result.challengeToken,
          expiresIn: result.expiresIn,
        };
      }
      setAccessToken(result.accessToken);
      const next: OperatorSession = {
        user: result.user,
        permissions: result.permissions,
      };
      setSession(next);
      scheduleSilentRefresh(result.expiresIn);
      return { kind: "session", session: next };
    },
    [scheduleSilentRefresh],
  );

  const verifyMfa = useCallback(
    async (challengeToken: string, code: string): Promise<OperatorSession> => {
      const auth = await operatorMfaVerify(challengeToken, code);
      setAccessToken(auth.accessToken);
      const next: OperatorSession = {
        user: auth.user,
        permissions: auth.permissions,
      };
      setSession(next);
      scheduleSilentRefresh(auth.expiresIn);
      return next;
    },
    [scheduleSilentRefresh],
  );

  const logout = useCallback(async () => {
    clearRefreshTimer();
    try {
      await operatorLogout();
    } catch {
      // Backend logout is best-effort. Even if it fails we still clear local
      // state so the operator cannot keep operating with a stale identity.
    }
    setAccessToken(null);
    setSession(null);
  }, [clearRefreshTimer]);

  const refresh = useCallback(async (): Promise<OperatorSession | null> => {
    const refreshed = await refreshOperatorSession();
    if (!refreshed) {
      setSession(null);
      return null;
    }
    const next: OperatorSession = {
      user: refreshed.user,
      permissions: refreshed.permissions,
    };
    setSession(next);
    scheduleSilentRefresh(refreshed.expiresIn);
    return next;
  }, [scheduleSilentRefresh]);

  return (
    <OperatorAuthContext.Provider
      value={{ session, loading, login, verifyMfa, logout, refresh }}
    >
      {children}
    </OperatorAuthContext.Provider>
  );
}
