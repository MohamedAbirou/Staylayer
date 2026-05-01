import { createContext } from "react";
import type { User } from "../lib/constants";

export interface AuthState {
  user: User | null;
  loading: boolean;
  getAccessToken: () => string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);
