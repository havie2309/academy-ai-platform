import { JwtService } from '@nestjs/jwt'
import type { NextFunction, Request, Response } from 'express'
import {
  resolveAccessScope,
  type AccessScope,
} from '../../../src/common/access-scope'

interface GatewayJwtPayload {
  sub: string
  username?: string
  roles?: string[]
  department?: string | null
  max_security_level?: number
}

export interface GatewayUser extends AccessScope {}

export interface GatewayRequest extends Request {
  gatewayUser?: GatewayUser
}

const PUBLIC_ROUTES = new Set([
  '/api/health',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/admin-config/health',
  '/api/rbac/health',
  '/api/audit/health',
])
const PROTECTED_PREFIXES = [
  '/api/users',
  '/api/chat',
  '/api/documents',
  '/api/rag',
  '/api/admin-config',
  '/api/rbac',
  '/api/audit',
]
const PROTECTED_ROUTES = new Set(['/api/auth/logout'])
const UNAUTHORIZED_MESSAGE =
  'Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.'

function normalizePath(pathname: string): string {
  const clean = pathname.split('?')[0] ?? pathname
  if (clean.length > 1 && clean.endsWith('/')) {
    return clean.slice(0, -1)
  }
  return clean
}

export function isProtectedPath(pathname: string): boolean {
  const path = normalizePath(pathname)
  if (PUBLIC_ROUTES.has(path)) return false
  if (PROTECTED_ROUTES.has(path)) return true
  return PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix))
}

function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

async function toGatewayUser(
  payload: GatewayJwtPayload,
): Promise<GatewayUser | null> {
  if (!payload.sub) return null
  return resolveAccessScope({
    userId: payload.sub,
    username: payload.username ?? '',
    roles: Array.isArray(payload.roles) ? payload.roles.map(String) : [],
    department: payload.department ?? null,
    maxSecurityLevel:
      typeof payload.max_security_level === 'number'
        ? payload.max_security_level
        : 1,
  })
}

function allowedOrigin(req: Request): string {
  const configured = (
    process.env.WEB_URL ??
    'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  const requestOrigin = req.headers.origin
  if (requestOrigin && configured.includes(requestOrigin)) {
    return requestOrigin
  }
  return configured[0] ?? 'http://localhost:5173'
}

function rejectUnauthorized(req: Request, res: Response): void {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin(req))
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Vary', 'Origin')
  res.status(401).json({ message: UNAUTHORIZED_MESSAGE })
}

export function createGatewayAuthMiddleware(jwtSecret: string) {
  const jwt = new JwtService({ secret: jwtSecret })

  return async (req: GatewayRequest, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') {
      next()
      return
    }

    if (!isProtectedPath(req.path || req.originalUrl || req.url)) {
      next()
      return
    }

    const token = readBearerToken(req)
    if (!token) {
      rejectUnauthorized(req, res)
      return
    }

    try {
      const payload = jwt.verify<GatewayJwtPayload>(token)
      const user = await toGatewayUser(payload)
      if (!user) {
        rejectUnauthorized(req, res)
        return
      }
      req.gatewayUser = user
      next()
    } catch {
      rejectUnauthorized(req, res)
    }
  }
}

export function attachGatewayUserHeaders(req: GatewayRequest, setHeader: (name: string, value: string) => void): void {
  const user = req.gatewayUser
  if (!user) return

  setHeader('x-gateway-user-id', user.userId)
  setHeader('x-gateway-username', user.username)
  setHeader('x-gateway-roles', user.roles.join(','))
  setHeader('x-gateway-normalized-roles', user.normalizedRoles.join(','))
  setHeader('x-gateway-department', user.department ?? '')
  setHeader('x-gateway-max-security-level', String(user.maxSecurityLevel))
  setHeader('x-gateway-scope-ma-hv', user.scopeMaHv ?? '')
  setHeader('x-gateway-scope-ma-gv', user.scopeMaGv ?? '')
  setHeader('x-gateway-access-scope', JSON.stringify(user))
}
