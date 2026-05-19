import { PlatformRole } from "@prisma/client";

/**
 * Operator-only JWT audience. Customer-dashboard access tokens do NOT carry
 * this claim, so the operator JWT strategy will reject them even if they
 * happen to authenticate the same underlying user. This is the primary
 * mechanism that keeps operator and customer sessions isolated end-to-end.
 */
export const OPERATOR_JWT_AUDIENCE = "operator-console";

/**
 * Operator-only JWT issuer. Combined with the audience claim this gives us a
 * double-checked invariant for operator tokens.
 */
export const OPERATOR_JWT_ISSUER = "staylayer-operator";

export const OPERATOR_ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const OPERATOR_REFRESH_TOKEN_TTL_SECONDS = 8 * 60 * 60; // 8 hours

/**
 * Cookie used to carry the operator refresh token. Intentionally different
 * from the customer dashboard's `refresh_token` cookie so the two sessions
 * never collide when both apps run on the same eTLD+1.
 */
export const OPERATOR_REFRESH_COOKIE = "operator_refresh_token";

/**
 * The refresh cookie is scoped to /operator/auth so that the customer
 * dashboard will not send it on any of its own auth or API endpoints, and so
 * that XHRs that don't need it never include it.
 */
export const OPERATOR_REFRESH_COOKIE_PATH = "/operator/auth";

export interface OperatorJwtAccessPayload {
  sub: string;
  email: string;
  /** Operator JWTs always carry a non-null role. */
  platformRole: PlatformRole;
  type: "operator-access";
  iat?: number;
  exp?: number;
  aud?: string;
  iss?: string;
}

export interface OperatorJwtRefreshPayload {
  sub: string;
  /** Unique token id; points to an `OperatorRefreshSession` row. */
  jti: string;
  type: "operator-refresh";
  iat?: number;
  exp?: number;
  aud?: string;
  iss?: string;
}

export interface OperatorUserProfile {
  id: string;
  email: string;
  platformRole: PlatformRole;
  mfaEnrolled: boolean;
  mfaEnrolledAt: string | null;
}

export interface OperatorSessionResponse {
  user: OperatorUserProfile;
  /**
   * Flat list of `resource.action.scope` permission keys derived from the
   * operator's platform role bundle. The frontend `useCan(...)` hook reads
   * this list directly; it is NOT a substitute for backend guards.
   */
  permissions: string[];
}

export interface OperatorAuthResponse extends OperatorSessionResponse {
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

/**
 * Phase 12 — returned by /operator/auth/login when the operator has MFA
 * enrolled. The caller must then POST to /operator/auth/mfa/verify with
 * the totp (or recovery) code and this challenge token to receive the
 * full {@link OperatorAuthResponse}.
 */
export interface OperatorMfaChallenge {
  mfaRequired: true;
  challengeToken: string;
  /** Seconds until the challenge token expires (short-lived). */
  expiresIn: number;
}

export interface OperatorMfaChallengePayload {
  sub: string;
  type: "operator-mfa-challenge";
  iat?: number;
  exp?: number;
  aud?: string;
  iss?: string;
}

export const OPERATOR_MFA_CHALLENGE_TTL_SECONDS = 5 * 60;

export interface OperatorAuthenticatedRequestUser extends OperatorUserProfile {
  /** Always carries the operator audience. */
  aud: typeof OPERATOR_JWT_AUDIENCE;
}
