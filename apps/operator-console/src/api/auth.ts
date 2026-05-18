import client from "./client";
import type {
  OperatorAuthResponse,
  OperatorSessionResponse,
} from "../auth/types";

export async function operatorLogin(
  email: string,
  password: string,
): Promise<OperatorAuthResponse> {
  const response = await client.post<OperatorAuthResponse>(
    "/operator/auth/login",
    { email, password },
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
