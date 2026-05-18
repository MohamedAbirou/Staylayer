import { useContext } from "react";
import { OperatorAuthContext } from "./AuthContext";

export function useOperatorAuth() {
  const ctx = useContext(OperatorAuthContext);
  if (!ctx) {
    throw new Error(
      "useOperatorAuth must be used within an OperatorAuthProvider",
    );
  }
  return ctx;
}
