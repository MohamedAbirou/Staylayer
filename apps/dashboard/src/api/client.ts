import axios from "axios";
import {
  ADMIN_LOGIN_PATH,
  API_URL,
  buildMarketingLoginUrl,
} from "../lib/constants";
import type { AuthApiResponse, AuthContextRequest } from "../auth/types";

const ACCESS_TOKEN_KEY = "auth_access_token";

interface WorkspaceContext {
  tenantId: string | null;
  siteId: string | null;
}

function readStoredAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

let accessToken: string | null = readStoredAccessToken();
let refreshRequest: Promise<AuthApiResponse> | null = null;
let workspaceContext: WorkspaceContext = {
  tenantId: null,
  siteId: null,
};

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
      sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  } catch {
    // Ignore storage failures to avoid breaking auth flow.
  }
}

export function setWorkspaceContext(context: AuthContextRequest | null): void {
  workspaceContext = {
    tenantId: context?.tenantId ?? null,
    siteId: context?.siteId ?? null,
  };
}

export function hasUsableAccessToken(bufferMs = 30_000): boolean {
  const token = getAccessToken();
  if (!token) {
    return false;
  }

  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as { exp?: number };
    if (!payload.exp) {
      return false;
    }

    return payload.exp * 1000 - Date.now() > bufferMs;
  } catch {
    return false;
  }
}

async function refreshSessionWithContext(
  context?: AuthContextRequest,
): Promise<AuthApiResponse> {
  if (!refreshRequest) {
    const requestContext = context ?? {
      tenantId: workspaceContext.tenantId ?? undefined,
      siteId: workspaceContext.siteId ?? undefined,
    };

    refreshRequest = axios
      .post<AuthApiResponse>(`${API_URL}/auth/refresh`, requestContext, {
        withCredentials: true,
      })
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        return data;
      })
      .catch((error) => {
        setAccessToken(null);
        throw error;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
}

export async function refreshSession(
  context?: AuthContextRequest,
): Promise<AuthApiResponse> {
  return refreshSessionWithContext(context);
}

function isSiteScopedRequest(url?: string): boolean {
  return !!url && (url.startsWith("/pages") || url.startsWith("/settings"));
}

const client = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (workspaceContext.tenantId) {
    config.headers["X-Active-Tenant-Id"] = workspaceContext.tenantId;
  }

  if (isSiteScopedRequest(config.url) && workspaceContext.siteId) {
    config.headers["X-Active-Site-Id"] = workspaceContext.siteId;

    const params = (config.params as Record<string, unknown> | undefined) ?? {};
    if (params.siteId === undefined) {
      config.params = { ...params, siteId: workspaceContext.siteId };
    }
  }

  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as
      | (typeof error.config & { _retry?: boolean })
      | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { accessToken: newToken } = await refreshSessionWithContext();
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return client(originalRequest);
      } catch {
        setAccessToken(null);
        const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        window.location.href = window.location.pathname.startsWith("/admin")
          ? ADMIN_LOGIN_PATH
          : buildMarketingLoginUrl(returnTo);
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default client;
