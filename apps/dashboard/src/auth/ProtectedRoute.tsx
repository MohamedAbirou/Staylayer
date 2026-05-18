import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { LoadingSpinner } from "../components/LoadingSpinner";
import {
  getDefaultAuthenticatedPath,
  hasActiveSite,
  hasMembershipRole,
  hasPlatformRole,
} from "./access";
import { ADMIN_LOGIN_PATH } from "../lib/constants";
import type { MembershipRole, PlatformRole } from "./types";

/**
 * Paths a no-workspace user is allowed to visit. Anything else funnels them
 * back to /no-workspace.
 */
const LIMBO_ALLOWLIST: readonly string[] = [
  "/no-workspace",
  "/profile",
  "/auth/handoff",
];

function isLimboAllowed(pathname: string): boolean {
  return LIMBO_ALLOWLIST.some(
    (allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`),
  );
}

interface ProtectedRouteProps {
  children?: React.ReactNode;
  platformRoles?: readonly PlatformRole[];
  membershipRoles?: readonly MembershipRole[];
  allowEither?: boolean;
  requireActiveSite?: boolean;
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  platformRoles,
  membershipRoles,
  allowEither = false,
  requireActiveSite = false,
  redirectTo,
}: ProtectedRouteProps) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!session) {
    if (platformRoles && !membershipRoles) {
      return <Navigate to={ADMIN_LOGIN_PATH} replace />;
    }

    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    const search =
      returnTo && returnTo !== "/login"
        ? `?returnTo=${encodeURIComponent(returnTo)}`
        : "";

    return <Navigate to={`/login${search}`} replace />;
  }

  // ─── Limbo state ────────────────────────────────────────────────────
  // Authenticated user with zero workspace memberships AND no platform role.
  // They've just deleted their last workspace, were removed from all
  // memberships, or never joined one. Funnel them through /no-workspace so
  // they can create, accept an invite, or delete their account.
  const isLimbo = session.memberships.length === 0 && !hasPlatformRole(session);
  if (isLimbo && !isLimboAllowed(location.pathname)) {
    return <Navigate to="/no-workspace" replace />;
  }
  // Inverse: if user lands on /no-workspace but is no longer in limbo
  // (e.g. accepted an invite in another tab), bounce home.
  if (!isLimbo && location.pathname === "/no-workspace") {
    return <Navigate to={getDefaultAuthenticatedPath(session)} replace />;
  }

  const platformAllowed = platformRoles
    ? hasPlatformRole(session, platformRoles)
    : false;
  const membershipAllowed = membershipRoles
    ? hasMembershipRole(session, membershipRoles)
    : false;

  let isAuthorized = true;
  if (platformRoles && membershipRoles) {
    isAuthorized = allowEither
      ? platformAllowed || membershipAllowed
      : platformAllowed && membershipAllowed;
  } else if (platformRoles) {
    isAuthorized = platformAllowed;
  } else if (membershipRoles) {
    isAuthorized = membershipAllowed;
  }

  if (!isAuthorized) {
    return (
      <Navigate
        to={redirectTo ?? getDefaultAuthenticatedPath(session)}
        replace
      />
    );
  }

  if (requireActiveSite && membershipAllowed && !hasActiveSite(session)) {
    return <Navigate to={redirectTo ?? "/"} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
