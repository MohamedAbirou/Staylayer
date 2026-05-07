import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./useAuth";
import { LoadingSpinner } from "../components/LoadingSpinner";
import {
  getDefaultAuthenticatedPath,
  hasActiveSite,
  hasMembershipRole,
  hasPlatformRole,
} from "./access";
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

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
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
