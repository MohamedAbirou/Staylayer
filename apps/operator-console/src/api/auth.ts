import client from "./client";
import type {
  OperatorAuthResponse,
  OperatorLoginResult,
  OperatorSessionResponse,
} from "../auth/types";

export async function operatorLogin(
  email: string,
  password: string,
): Promise<OperatorLoginResult> {
  const response = await client.post<OperatorLoginResult>(
    "/operator/auth/login",
    { email, password },
  );
  return response.data;
}

export async function operatorMfaVerify(
  challengeToken: string,
  code: string,
): Promise<OperatorAuthResponse> {
  const response = await client.post<OperatorAuthResponse>(
    "/operator/auth/mfa/verify",
    { challengeToken, code },
  );
  return response.data;
}

export async function operatorMfaEnrollInitiate(): Promise<{
  secret: string;
  otpauthUri: string;
}> {
  const response = await client.post<{ secret: string; otpauthUri: string }>(
    "/operator/auth/mfa/enroll/initiate",
    {},
  );
  return response.data;
}

export async function operatorMfaEnrollConfirm(
  code: string,
): Promise<{ enrolledAt: string; recoveryCodes: string[] }> {
  const response = await client.post<{
    enrolledAt: string;
    recoveryCodes: string[];
  }>("/operator/auth/mfa/enroll/confirm", { code });
  return response.data;
}

/**
 * Regenerate the 10 single-use recovery codes for the currently signed-in
 * operator. The server requires a fresh TOTP code from the operator's
 * authenticator app, so this only works while the authenticator is still
 * available. The previous recovery codes are invalidated server-side and
 * cannot be re-fetched.
 */
export async function operatorMfaRegenerateRecoveryCodes(
  code: string,
): Promise<{ recoveryCodes: string[] }> {
  const response = await client.post<{ recoveryCodes: string[] }>(
    "/operator/auth/mfa/recovery-codes/regenerate",
    { code },
  );
  return response.data;
}

export async function operatorLogout(): Promise<void> {
  await client.post("/operator/auth/logout");
}

export async function fetchOperatorSession(): Promise<OperatorSessionResponse> {
  const response = await client.get<OperatorSessionResponse>(
    "/operator/auth/session",
  );
  return response.data;
}
