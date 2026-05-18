import { Navigate, Outlet } from "react-router-dom";
import { usePermissions } from "./useCan";

interface PermissionRouteProps {
  /** Single permission required to render the route subtree. */
  permission?: string;
  /** Any of these permissions are sufficient. */
  anyOf?: readonly string[];
  /** All of these permissions are required. */
  allOf?: readonly string[];
  /** Where to redirect when access is denied. Defaults to `/forbidden`. */
  redirectTo?: string;
}

/**
 * React Router 6 route guard that renders `<Outlet />` when the operator
 * session carries the required permission(s), otherwise redirects to
 * `/forbidden` (or the supplied path).
 *
 * Must be nested **below** the auth-gating `ProtectedOperatorRoute` so we
 * only run this check for authenticated operators.
 */
export function PermissionRoute({
  permission,
  anyOf,
  allOf,
  redirectTo = "/forbidden",
}: PermissionRouteProps) {
  const { loading, can, canAny, canAll } = usePermissions();

  if (loading) {
    return null;
  }

  let allowed: boolean;
  if (permission) {
    allowed = can(permission);
  } else if (anyOf && anyOf.length > 0) {
    allowed = canAny(anyOf);
  } else if (allOf && allOf.length > 0) {
    allowed = canAll(allOf);
  } else {
    allowed = false;
  }

  if (!allowed) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
