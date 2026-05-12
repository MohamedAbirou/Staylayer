import { setAccessToken, setWorkspaceContext } from "../api/client";
import type { AuthApiResponse, AuthContextRequest, AuthSession } from "./types";

const AUTH_SESSION_KEY = "auth_session";

function fromBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = padding
    ? `${normalized}${"=".repeat(4 - padding)}`
    : normalized;
  return atob(padded);
}

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function setStoredSession(session: AuthSession | null): void {
  if (typeof window === "undefined") return;
  try {
    if (session) {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(AUTH_SESSION_KEY);
    }
  } catch {
    // Ignore storage failures to avoid breaking auth flow.
  }
}

export function extractSession(response: AuthApiResponse): AuthSession {
  const { accessToken: _accessToken, ...session } = response;
  return session;
}

export function toWorkspaceContext(
  session: AuthSession | null,
): AuthContextRequest | null {
  if (!session?.activeTenant && !session?.activeSite) {
    return null;
  }

  return {
    tenantId: session.activeTenant?.id,
    siteId: session.activeSite?.id,
  };
}

function sanitizeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

export function readSessionHandoff(
  location: Pick<Location, "pathname" | "hash">,
): {
  response: AuthApiResponse;
  next: string | null;
} | null {
  if (location.pathname !== "/auth/handoff" || !location.hash) {
    return null;
  }

  const params = new URLSearchParams(location.hash.slice(1));
  const payload = params.get("payload");

  if (!payload) {
    return null;
  }

  try {
    const response = JSON.parse(fromBase64Url(payload)) as AuthApiResponse;
    return {
      response,
      next: sanitizeNextPath(params.get("next")),
    };
  } catch {
    return null;
  }
}

export function primeSessionFromHandoff(
  location: Pick<Location, "pathname" | "hash">,
): AuthSession | null {
  const handoff = readSessionHandoff(location);

  if (!handoff) {
    return getStoredSession();
  }

  const session = extractSession(handoff.response);
  setAccessToken(handoff.response.accessToken);
  setWorkspaceContext(toWorkspaceContext(session));
  setStoredSession(session);
  return session;
}
