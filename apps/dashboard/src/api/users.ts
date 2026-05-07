import client from "./client";
import type { OperatorUser, PlatformRole } from "../auth/types";
import type { PaginatedResponse } from "../lib/constants";

export async function getUsers(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<OperatorUser>> {
  const { data } = await client.get<PaginatedResponse<OperatorUser>>("/users", {
    params,
  });
  return data;
}

interface CreateUserPayload {
  email: string;
  password: string;
  platformRole: PlatformRole;
}

export async function createUser(
  payload: CreateUserPayload,
): Promise<OperatorUser> {
  const { data } = await client.post<OperatorUser>("/users", payload);
  return data;
}

interface UpdateUserPayload {
  email?: string;
  password?: string;
  platformRole?: PlatformRole;
}

export async function updateUser(
  id: string,
  payload: UpdateUserPayload,
): Promise<OperatorUser> {
  const { data } = await client.patch<OperatorUser>(`/users/${id}`, payload);
  return data;
}

export async function deleteUser(id: string): Promise<void> {
  await client.delete(`/users/${id}`);
}
