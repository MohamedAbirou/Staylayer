import axios from "axios";
import { API_URL } from "../lib/constants";

const ACCESS_TOKEN_KEY = "auth_access_token";

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
let refreshRequest: Promise<{ accessToken: string; user: unknown }> | null =
  null;

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

export async function refreshSession(): Promise<{
  accessToken: string;
  user: unknown;
}> {
  if (!refreshRequest) {
    refreshRequest = axios
      .post<{ accessToken: string; user: unknown }>(
        `${API_URL}/auth/refresh`,
        {},
        { withCredentials: true },
      )
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

const client = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
        const { accessToken: newToken } = await refreshSession();
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return client(originalRequest);
      } catch {
        setAccessToken(null);
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default client;
