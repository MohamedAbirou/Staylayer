function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

// API base URL. In dev defaults to "/api" so the Vite proxy in vite.config.ts forwards
// to http://localhost:4000. In production, set VITE_API_URL to the public API host.
export const API_URL = trimTrailingSlash(
  import.meta.env.VITE_API_URL || "/api",
);

// Login URL for the operator console. The operator login flow is introduced in Phase 2;
// until then this resolves to the in-app placeholder route /login.
export const OPERATOR_LOGIN_URL =
  import.meta.env.VITE_OPERATOR_LOGIN_URL || "/login";

export const APP_NAME = "StayLayer Operator Console";
