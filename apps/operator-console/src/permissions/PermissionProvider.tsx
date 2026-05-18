import { useMemo, type ReactNode } from "react";
import { useOperatorAuth } from "../auth/useOperatorAuth";
import { OperatorPermissionContext } from "./PermissionContext";
import { hasAllPermissions, hasAnyPermission, hasPermission } from "./registry";

/**
 * Exposes the granular permission set carried on the operator session.
 *
 * The provider is intentionally a thin reactive view over `useOperatorAuth`:
 * we never derive permissions on the client from the platform role —
 * permissions are authoritatively granted by the API in the session payload
 * so a role bundle change rolls out without redeploying the operator app.
 */
export function PermissionProvider({ children }: { children: ReactNode }) {
  const { session, loading } = useOperatorAuth();

  const value = useMemo(() => {
    const set = new Set<string>(session?.permissions ?? []);
    return {
      permissions: set as ReadonlySet<string>,
      loading,
      can: (key: string) => hasPermission(set, key),
      canAll: (keys: readonly string[]) => hasAllPermissions(set, keys),
      canAny: (keys: readonly string[]) => hasAnyPermission(set, keys),
    };
  }, [session?.permissions, loading]);

  return (
    <OperatorPermissionContext.Provider value={value}>
      {children}
    </OperatorPermissionContext.Provider>
  );
}
