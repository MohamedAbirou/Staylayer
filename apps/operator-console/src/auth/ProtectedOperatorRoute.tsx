import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useOperatorAuth } from "./useOperatorAuth";
import type { PlatformRole } from "./types";

interface ProtectedOperatorRouteProps {
  // If provided, the route is only accessible to operators whose
  // platformRole is in the list. Empty/undefined means any authenticated
  // operator. Phase 3 introduces granular permissions on top of role bundles.
  allowedRoles?: ReadonlyArray<PlatformRole>;
}

export function ProtectedOperatorRoute({
  allowedRoles,
}: ProtectedOperatorRouteProps) {
  const { session, loading } = useOperatorAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <span className="text-sm">Loading operator console…</span>
      </div>
    );
  }

  if (!session) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(session.user.platformRole)) {
      return <Navigate to="/forbidden" replace />;
    }
  }

  return <Outlet />;
}
