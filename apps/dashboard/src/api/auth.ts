import axios from "axios";
import client, { refreshSession } from "./client";
import { API_URL } from "../lib/constants";
import type { AuthApiResponse, AuthContextRequest } from "../auth/types";

export async function login(
  email: string,
  password: string,
  context?: AuthContextRequest,
): Promise<AuthApiResponse> {
  const { data } = await axios.post<AuthApiResponse>(
    `${API_URL}/auth/login`,
    { email, password, ...context },
    { withCredentials: true },
  );
  return data;
}

export async function refresh(
  context?: AuthContextRequest,
): Promise<AuthApiResponse> {
  return refreshSession(context) as Promise<AuthApiResponse>;
}

export async function switchWorkspaceContext(
  context: AuthContextRequest,
): Promise<AuthApiResponse> {
  const { data } = await client.post<AuthApiResponse>("/auth/context", context);
  return data;
}

export async function logout(): Promise<void> {
  await client.post("/auth/logout");
}
