import { Navigate, useLocation } from "react-router-dom";
import { getDefaultAuthenticatedPath } from "../auth/access";
import { useAuth } from "../auth/useAuth";
import { readSessionHandoff } from "../auth/session-storage";

export default function AuthHandoffPage() {
  const location = useLocation();
  const { session } = useAuth();
  const handoff = readSessionHandoff(location);

  if (!handoff) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Navigate
      to={handoff.next || getDefaultAuthenticatedPath(session)}
      replace
    />
  );
}
