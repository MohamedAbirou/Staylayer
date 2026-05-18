import { createContext } from "react";

export interface OperatorPermissionContextValue {
  /** Permission keys granted to the current operator session. */
  permissions: ReadonlySet<string>;
  /** True while the parent auth provider is still bootstrapping. */
  loading: boolean;
  /**
   * Convenience predicate honouring `.all` superset semantics and the `*`
   * wildcard. Identical to `hasPermission(permissions, key)`.
   */
  can: (key: string) => boolean;
  canAll: (keys: readonly string[]) => boolean;
  canAny: (keys: readonly string[]) => boolean;
}

export const OperatorPermissionContext =
  createContext<OperatorPermissionContextValue | null>(null);
