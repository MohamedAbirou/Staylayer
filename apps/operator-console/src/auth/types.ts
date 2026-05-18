// Operator console session/auth contracts. These mirror the backend
// `/operator/auth/*` response shapes. The operator app never imports
// customer dashboard auth types.

export const PLATFORM_ROLES = [
  "PLATFORM_OWNER",
  "SUPPORT_ADMIN",
  "FINANCE_ADMIN",
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export interface OperatorUser {
  id: string;
  email: string;
  platformRole: PlatformRole;
}

export interface OperatorSession {
  user: OperatorUser;
  /** Granular permission keys (`resource.action.scope`). */
  permissions: string[];
}

export interface OperatorSessionResponse {
  user: OperatorUser;
  permissions: string[];
}

export interface OperatorAuthResponse {
  accessToken: string;
  expiresIn: number;
  user: OperatorUser;
  permissions: string[];
}

export interface OperatorAuthError {
  code: string;
  message: string;
}
