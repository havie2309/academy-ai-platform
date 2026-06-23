import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { authApi } from '../api/auth'
import { hasAllowedRole } from '../lib/authz'

interface RequireAuthProps {
  allowedRoles?: string[]
  publicRoutes?: string[]
}

const requireAuth = import.meta.env.VITE_REQUIRE_AUTH !== 'false'

// Routes that don't require login
const DEFAULT_PUBLIC_ROUTES = ['/chat', '/docs', '/']

export default function RequireAuth({ allowedRoles, publicRoutes = DEFAULT_PUBLIC_ROUTES }: RequireAuthProps) {
  const location = useLocation()

  // If auth is disabled globally, allow all
  if (!requireAuth) {
    return <Outlet />
  }

  // If route is public, allow access without login
  if (publicRoutes.some((route) => location.pathname.startsWith(route))) {
    return <Outlet />
  }

  const token = authApi.getToken()
  const user = authApi.getUser()

  if (!token || !user || user.id === 'anonymous') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = hasAllowedRole(user.roles, allowedRoles)
    if (!hasRole) {
      return <Navigate to="/chat" replace />
    }
  }

  return <Outlet />
}