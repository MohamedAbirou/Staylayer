import axios from "axios";
import client, { refreshSession } from "./client";
import { API_URL } from "../lib/constants";
import type { User } from "../lib/constants";

interface LoginResponse {
  accessToken: string;
  user: User;
}

interface RefreshResponse {
  accessToken: string;
  user: User;
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const { data } = await axios.post<LoginResponse>(
    `${API_URL}/auth/login`,
    { email, password },
    { withCredentials: true },
  );
  return data;
}

export async function refresh(): Promise<RefreshResponse> {
  return refreshSession() as Promise<RefreshResponse>;
}

export async function logout(): Promise<void> {
  await client.post("/auth/logout");
}
