import axios, {
  AxiosError,
  AxiosHeaders,
  AxiosResponse,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { API_URL } from "../lib/constants";
import type { OperatorAuthResponse, OperatorSession } from "../auth/types";

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

/**
 * Custom DOM events used to bridge the axios client and the React auth
 * provider without creating an import cycle. The provider subscribes to
 * these events to keep its session state in sync with token rotations and
 * unauthenticated responses originating from any HTTP call.
 */
export const OPERATOR_AUTH_EVENTS = {
  refreshed: "operator-auth:refreshed",
  unauthenticated: "operator-auth:unauthenticated",
} as const;

export interface OperatorAuthRefreshedDetail {
  session: OperatorSession;
}

function emit(name: string, detail?: unknown): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

const client = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

function setAuthHeader(
  config: InternalAxiosRequestConfig,
  token: string | null,
): void {
  if (!token) return;
  if (config.headers instanceof AxiosHeaders) {
    config.headers.set("Authorization", `Bearer ${token}`);
    return;
  }
  config.headers = new AxiosHeaders({
    ...(config.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${token}`,
  });
}

client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    setAuthHeader(config, token);
  }
  // Explicit marker so the backend can distinguish operator console traffic
  // from customer dashboard traffic in observability and audit logs.
  if (config.headers instanceof AxiosHeaders) {
    config.headers.set("X-Operator-Console", "1");
  } else {
    config.headers = new AxiosHeaders({
      ...(config.headers as Record<string, string> | undefined),
      "X-Operator-Console": "1",
    });
  }
  return config;
});

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _operatorRetried?: boolean;
}

/**
 * Endpoints that must never trigger the refresh-on-401 flow. Calling refresh
 * recursively on a failed refresh would loop forever, and we never want a
 * failed login attempt to be silently retried.
 */
const REFRESH_EXEMPT_PATHS = [
  "/operator/auth/refresh",
  "/operator/auth/login",
  "/operator/auth/logout",
  "/operator/auth/mfa/verify",
];

function isRefreshExempt(url: string | undefined): boolean {
  if (!url) return false;
  return REFRESH_EXEMPT_PATHS.some((p) => url.includes(p));
}

let inflightRefresh: Promise<OperatorAuthResponse | null> | null = null;

async function performRefresh(): Promise<OperatorAuthResponse | null> {
  try {
    const response = await axios.post<OperatorAuthResponse>(
      "/operator/auth/refresh",
      {},
      {
        baseURL: API_URL,
        withCredentials: true,
        headers: { "X-Operator-Console": "1" },
      },
    );
    setAccessToken(response.data.accessToken);
    emit(OPERATOR_AUTH_EVENTS.refreshed, {
      session: {
        user: response.data.user,
        permissions: response.data.permissions,
      },
    } satisfies OperatorAuthRefreshedDetail);
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Public helper used by the auth provider for bootstrapping. Falls back to a
 * single in-flight refresh request so concurrent callers share the result.
 */
export async function refreshOperatorSession(): Promise<OperatorAuthResponse | null> {
  if (!inflightRefresh) {
    inflightRefresh = performRefresh().finally(() => {
      inflightRefresh = null;
    });
  }
  return inflightRefresh;
}

function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const url = new URL("/login", window.location.origin);
  if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    url.searchParams.set("returnTo", returnTo);
  }
  window.location.href = url.toString();
}

client.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const original = error.config as RetriableRequestConfig | undefined;

    if (status !== 401 || !original || original._operatorRetried) {
      return Promise.reject(error);
    }

    if (isRefreshExempt(original.url)) {
      // A 401 on refresh itself means the operator session is fully gone.
      // For login or logout, callers handle the error inline.
      if (original.url?.includes("/operator/auth/refresh")) {
        setAccessToken(null);
        emit(OPERATOR_AUTH_EVENTS.unauthenticated);
        redirectToLogin();
      }
      return Promise.reject(error);
    }

    original._operatorRetried = true;
    const refreshed = await refreshOperatorSession();

    if (!refreshed) {
      setAccessToken(null);
      emit(OPERATOR_AUTH_EVENTS.unauthenticated);
      redirectToLogin();
      return Promise.reject(error);
    }

    // Retry the original request with the new access token.
    setAuthHeader(original, refreshed.accessToken);
    return client(original as AxiosRequestConfig);
  },
);

export { client };
export default client;
