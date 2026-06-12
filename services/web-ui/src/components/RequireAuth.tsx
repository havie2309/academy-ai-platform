import { Navigate, Outlet } from "react-router-dom";
import { authApi } from "../api/auth";

interface RequireAuthProps {
  allowedRoles?: string[];
}

const requireAuth = import.meta.env.VITE_REQUIRE_AUTH !== "false";

export default function RequireAuth({ allowedRoles }: RequireAuthProps) {
  if (!requireAuth) {
    return <Outlet />;
  }

  const token = authApi.getToken();
  const user  = authApi.getUser();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = user.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      return <Navigate to="/chat" replace />;
    }
  }

  return <Outlet />;
}