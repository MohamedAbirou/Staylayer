import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./useAuth";
import { LoadingSpinner } from "../components/LoadingSpinner";
import type { Role } from "../lib/constants";

interface ProtectedRouteProps {
  children?: React.ReactNode;
  roles?: Role[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
