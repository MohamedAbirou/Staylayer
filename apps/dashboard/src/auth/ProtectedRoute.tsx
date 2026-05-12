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
