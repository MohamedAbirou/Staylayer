import { useState, useEffect, useCallback, type ReactNode } from "react";
import { AuthContext } from "./AuthContext";
import {
  login as loginApi,
  refresh as refreshApi,
  logout as logoutApi,
} from "../api/auth";
import {
  getAccessToken,
  hasUsableAccessToken,
  setAccessToken,
} from "../api/client";
import type { User } from "../lib/constants";

const AUTH_USER_KEY = "auth_user";

function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function setStoredUser(user: User | null): void {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
  } catch {
    // Ignore storage failures to avoid breaking auth flow.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const cachedUser = getStoredUser();
    if (cachedUser) {
      setUser(cachedUser);
    }

    if (cachedUser && hasUsableAccessToken()) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    refreshApi()
      .then(({ accessToken, user: u }) => {
        if (cancelled) return;
        setAccessToken(accessToken);
        setUser(u);
        setStoredUser(u);
      })
      .catch(() => {
        if (cancelled) return;
        // No valid session — clear everything so ProtectedRoute redirects.
        setAccessToken(null);
        setUser(null);
        setStoredUser(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const msUntilRefresh = payload.exp * 1000 - Date.now() - 60_000;
      const timer = setTimeout(
        async () => {
          try {
            const { accessToken, user: u } = await refreshApi();
            setAccessToken(accessToken);
            setUser(u);
            setStoredUser(u);
          } catch {
            setAccessToken(null);
            setUser(null);
            setStoredUser(null);
          }
        },
        Math.max(msUntilRefresh, 0),
      );
      return () => clearTimeout(timer);
    } catch {
      return;
    }
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, user: u } = await loginApi(email, password);
    setAccessToken(accessToken);
    setUser(u);
    setStoredUser(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } finally {
      setAccessToken(null);
      setUser(null);
      setStoredUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, getAccessToken, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
