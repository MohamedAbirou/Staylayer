import axios from "axios";
import { API_URL } from "../lib/constants";

// Session storage keys are namespaced under "operator_" so that the operator
// console NEVER shares auth state with the customer dashboard, even when both
// apps are open in the same browser on different ports.
const OPERATOR_ACCESS_TOKEN_KEY = "operator_auth_access_token";

function readStoredAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return sessionStorage.getItem(OPERATOR_ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

let accessToken: string | null = readStoredAccessToken();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (token) {
      sessionStorage.setItem(OPERATOR_ACCESS_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(OPERATOR_ACCESS_TOKEN_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

// Phase 1 scaffolding: the API client has an Authorization header interceptor
// and a 401 handler that clears the operator session. Real operator auth
// endpoints (`/operator/auth/*`) are introduced in Phase 2.
const client = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Explicit marker so the backend can distinguish operator console traffic
  // from customer dashboard traffic in observability and audit logs.
  config.headers["X-Operator-Console"] = "1";
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      setAccessToken(null);
      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/login"
      ) {
        const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        const url = new URL("/login", window.location.origin);
        if (
          returnTo &&
          returnTo.startsWith("/") &&
          !returnTo.startsWith("//")
        ) {
          url.searchParams.set("returnTo", returnTo);
        }
        window.location.href = url.toString();
      }
    }
    return Promise.reject(error);
  },
);

export default client;
