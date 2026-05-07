import { createContext } from "react";
import type { AuthContextRequest, AuthSession, AuthUser } from "./types";

export interface AuthState {
  session: AuthSession | null;
  user: AuthUser | null;
  loading: boolean;
  getAccessToken: () => string | null;
  login: (email: string, password: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
  switchWorkspace: (context: AuthContextRequest) => Promise<AuthSession>;
}

export const AuthContext = createContext<AuthState | null>(null);
