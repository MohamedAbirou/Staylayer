import { useContext } from "react";
import { OperatorPermissionContext } from "./PermissionContext";

/**
 * Returns `true` when the current operator session holds the given
 * permission key. Returns `false` until the parent `PermissionProvider`
 * has finished bootstrapping the session.
 *
 * Honours `.all` superset semantics (e.g. `tenant.update.all` satisfies
 * `tenant.update.region:eu`) and the `*` wildcard.
 *
 * Throws if used outside a `PermissionProvider` — this prevents accidental
 * "open by default" rendering when the context has not been wired up.
 */
export function useCan(key: string): boolean {
  const ctx = useContext(OperatorPermissionContext);
  if (!ctx) {
    throw new Error("useCan must be used inside a PermissionProvider");
  }
  return ctx.can(key);
}

export function useCanAll(keys: readonly string[]): boolean {
  const ctx = useContext(OperatorPermissionContext);
  if (!ctx) {
    throw new Error("useCanAll must be used inside a PermissionProvider");
  }
  return ctx.canAll(keys);
}

export function useCanAny(keys: readonly string[]): boolean {
  const ctx = useContext(OperatorPermissionContext);
  if (!ctx) {
    throw new Error("useCanAny must be used inside a PermissionProvider");
  }
  return ctx.canAny(keys);
}

/** Full permission context for advanced use cases. */
export function usePermissions() {
  const ctx = useContext(OperatorPermissionContext);
  if (!ctx) {
    throw new Error("usePermissions must be used inside a PermissionProvider");
  }
  return ctx;
}
