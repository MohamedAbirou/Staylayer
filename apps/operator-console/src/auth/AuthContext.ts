import { createContext } from "react";
import type { OperatorSession } from "./types";

export interface OperatorAuthContextValue {
  session: OperatorSession | null;
  loading: boolean;
  // Phase 1: placeholder API. Phase 2 wires these to `/operator/auth/*`.
  login: (email: string, password: string) => Promise<OperatorSession>;
  logout: () => Promise<void>;
  refresh: () => Promise<OperatorSession | null>;
}

export const OperatorAuthContext =
  createContext<OperatorAuthContextValue | null>(null);
