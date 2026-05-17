import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { AuthContext } from "./AuthContext";
import {
  login as loginApi,
  refresh as refreshApi,
  logout as logoutApi,
  switchWorkspaceContext as switchWorkspaceContextApi,
} from "../api/auth";
import {
  getAccessToken,
  hasUsableAccessToken,
  setAccessToken,
  setWorkspaceContext,
} from "../api/client";
import type { AuthApiResponse, AuthContextRequest, AuthSession } from "./types";
import {
  extractSession,
  primeSessionFromHandoff,
  setStoredSession,
  toWorkspaceContext,
} from "./session-storage";

const CUSTOMER_QUERY_PREFIXES = new Set([
  "pages",
  "page",
  "versions",
  "settings",
]);

function didWorkspaceChange(
  previous: AuthSession | null,
  next: AuthSession | null,
): boolean {
  const previousContext = toWorkspaceContext(previous);
  const nextContext = toWorkspaceContext(next);

  return (
    previousContext?.tenantId !== nextContext?.tenantId ||
    previousContext?.siteId !== nextContext?.siteId
  );
}

function isCustomerQuery(queryKey: QueryKey): boolean {
  const head = queryKey[0];
  return typeof head === "string" && CUSTOMER_QUERY_PREFIXES.has(head);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const storedSessionRef = useRef<AuthSession | null>(
    typeof window === "undefined"
      ? null
      : primeSessionFromHandoff(window.location),
  );
  const [session, setSession] = useState<AuthSession | null>(
    () => storedSessionRef.current,
  );
  const [loading, setLoading] = useState(true);

  const syncSession = useCallback(
    (response: AuthApiResponse | null) => {
      const nextSession = response ? extractSession(response) : null;
      const workspaceChanged = didWorkspaceChange(
        storedSessionRef.current,
        nextSession,
      );

      setAccessToken(response?.accessToken ?? null);
      setWorkspaceContext(toWorkspaceContext(nextSession));
      setStoredSession(nextSession);
      storedSessionRef.current = nextSession;

      startTransition(() => {
        setSession(nextSession);
      });

      if (workspaceChanged) {
        queryClient.removeQueries({
          predicate: (query) => isCustomerQuery(query.queryKey),
        });
      }
    },
    [queryClient],
  );

  const refreshCurrentSession = useCallback(
    async (context?: AuthContextRequest) => {
      const response = await refreshApi(
        context ?? toWorkspaceContext(storedSessionRef.current) ?? undefined,
      );
      syncSession(response);
      return extractSession(response);
    },
    [syncSession],
  );

  useEffect(() => {
    let cancelled = false;

    const cachedSession = storedSessionRef.current;
    setWorkspaceContext(toWorkspaceContext(cachedSession));

    if (cachedSession) {
      setSession(cachedSession);
    }

    if (cachedSession && hasUsableAccessToken()) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    refreshCurrentSession()
      .then(() => {
        if (cancelled) return;
      })
      .catch(() => {
        if (cancelled) return;
        syncSession(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshCurrentSession, syncSession]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const msUntilRefresh = payload.exp * 1000 - Date.now() - 60_000;
      const timer = setTimeout(
        async () => {
          try {
            await refreshCurrentSession();
          } catch {
            syncSession(null);
          }
        },
        Math.max(msUntilRefresh, 0),
      );
      return () => clearTimeout(timer);
    } catch {
      return;
    }
  }, [refreshCurrentSession, session, syncSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await loginApi(email, password);
      syncSession(response);
      return extractSession(response);
    },
    [syncSession],
  );

  const switchWorkspace = useCallback(
    async (context: AuthContextRequest) => {
      const response = await switchWorkspaceContextApi(context);
      syncSession(response);
      return extractSession(response);
    },
    [syncSession],
  );

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } finally {
      syncSession(null);
      queryClient.removeQueries({
        predicate: (query) => isCustomerQuery(query.queryKey),
      });
    }
  }, [queryClient, syncSession]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        getAccessToken,
        login,
        logout,
        switchWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
