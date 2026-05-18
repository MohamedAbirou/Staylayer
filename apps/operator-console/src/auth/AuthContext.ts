import { createContext } from "react";
import type { OperatorSession } from "./types";

export interface OperatorAuthContextValue {
  session: OperatorSession | null;
  /** True while the initial session bootstrap is running. */
  loading: boolean;
  login: (email: string, password: string) => Promise<OperatorSession>;
  logout: () => Promise<void>;
  refresh: () => Promise<OperatorSession | null>;
}

export const OperatorAuthContext =
  createContext<OperatorAuthContextValue | null>(null);
