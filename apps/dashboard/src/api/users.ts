import client from "./client";
import type { User, PaginatedResponse, Role } from "../lib/constants";

export async function getUsers(
  params?: { page?: number; limit?: number },
): Promise<PaginatedResponse<User>> {
  const { data } = await client.get<PaginatedResponse<User>>("/users", {
    params,
  });
  return data;
}

interface CreateUserPayload {
  email: string;
  password: string;
  role: Role;
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  const { data } = await client.post<User>("/users", payload);
  return data;
}

interface UpdateUserPayload {
  email?: string;
  password?: string;
  role?: Role;
}

export async function updateUser(
  id: string,
  payload: UpdateUserPayload,
): Promise<User> {
  const { data } = await client.patch<User>(`/users/${id}`, payload);
  return data;
}

export async function deleteUser(id: string): Promise<void> {
  await client.delete(`/users/${id}`);
}
