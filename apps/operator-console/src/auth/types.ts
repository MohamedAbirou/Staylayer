// Operator console session/auth contracts.
// These mirror the backend `platformRole` values today but live in a
// console-local namespace so the operator app does not import dashboard types.
// Phase 2 introduces dedicated `/operator/auth/*` endpoints and may evolve
// these types (e.g. adding MFA challenge state).

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
}

export interface OperatorAuthResponse extends OperatorSession {
  accessToken: string;
}
