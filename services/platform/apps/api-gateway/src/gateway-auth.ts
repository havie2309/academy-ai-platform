import { JwtService } from '@nestjs/jwt'
import type { NextFunction, Request, Response } from 'express'
import {
  resolveAccessScope,
  type AccessScope,
} from '../../../src/common/access-scope'
import { extractFormattedBearerJwt } from '../../../src/common/jwt-token-format'
import { SecurityAlertsService } from '../../../src/common/security-alerts.service'
import { normalizeRequestPath, resolveClientIp } from './request-network'

interface GatewayJwtPayload {
  sub: string
  username?: string
  roles?: string[]
  department?: string | null
  max_security_level?: number
  sid?: string
  iat?: number
  exp?: number
  iat_ms?: number
}

export interface GatewayUser extends AccessScope {
  sessionId?: string | null
}

export interface GatewayRequest extends Request {
  gatewayUser?: GatewayUser
}

export interface AccessTokenRevocationChecker {
  isAccessTokenRevoked(
    payload: Pick<GatewayJwtPayload, 'sub' | 'sid' | 'iat' | 'iat_ms'>,
  ): Promise<boolean>
}

// ============================================================
// PUBLIC ROUTES – no authentication required
// ============================================================

const PUBLIC_ROUTES = new Set([
  '/api/health',
  '/api/auth/health',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/etl/health',
  '/api/admin-config/health',
  '/api/rbac/health',
  '/api/audit/health',
])

// Prefix-based public routes
const PUBLIC_PREFIXES = [
  '/api/documents/public',   // Public document endpoints
]

const PROTECTED_PREFIXES = [
  '/api/users',
  '/api/chat',
  '/api/documents',          // Protected by default, except /public
  '/api/etl',
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

// ============================================================
// NEW: Check if path is public
// ============================================================

// GET /api/documents endpoints that are intentionally public (no JWT required).
// Downstream canView() still enforces security level for anonymous users (maxSecurityLevel=1).
const PUBLIC_DOCUMENTS_PATHS = new Set([
  '/api/documents',
  '/api/documents/ingest-statuses',
])
const INGEST_STATUS_RE = /^\/api\/documents\/[^/]+\/ingest-status$/

export function isPublicPath(pathname: string, method?: string): boolean {
  const path = normalizePath(pathname)
  if (PUBLIC_ROUTES.has(path)) return true
  if (method === 'GET') {
    if (PUBLIC_DOCUMENTS_PATHS.has(path)) return true
    if (INGEST_STATUS_RE.test(path)) return true
  }
  for (const prefix of PUBLIC_PREFIXES) {
    if (path.startsWith(prefix)) return true
  }
  return false
}

export function isProtectedPath(pathname: string, method?: string): boolean {
  if (isPublicPath(pathname, method)) return false
  const path = normalizePath(pathname)
  if (PROTECTED_ROUTES.has(path)) return true
  return PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix))
}

async function toGatewayUser(
  payload: GatewayJwtPayload,
): Promise<GatewayUser | null> {
  if (!payload.sub) return null
  const scope = await resolveAccessScope({
    userId: payload.sub,
    username: payload.username ?? '',
    roles: Array.isArray(payload.roles) ? payload.roles.map(String) : [],
    department: payload.department ?? null,
    maxSecurityLevel:
      typeof payload.max_security_level === 'number'
        ? payload.max_security_level
        : 1,
  })
  return {
    ...scope,
    sessionId: payload.sid ?? null,
  }
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

// ============================================================
// NEW: Create anonymous user context
// ============================================================

function createAnonymousUser(req: Request): GatewayUser {
  return {
    userId: 'anonymous',
    username: 'anonymous',
    roles: ['Anonymous'],
    normalizedRoles: ['ANONYMOUS'],
    department: null,
    maxSecurityLevel: 1,
    scopeMaHv: null,
    scopeMaGv: null,
    sessionId: null,
  }
}

export function createGatewayAuthMiddleware(
  jwtSecret: string,
  tokenRevocations?: AccessTokenRevocationChecker,
  securityAlerts?: SecurityAlertsService,
) {
  const jwt = new JwtService({ secret: jwtSecret })

  return async (req: GatewayRequest, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') {
      next()
      return
    }

    const token = extractFormattedBearerJwt(req)

    // 1. If a token is provided, try to validate it
    if (token) {
      try {
        const payload = jwt.verify<GatewayJwtPayload>(token)
        const user = await toGatewayUser(payload)
        if (user) {
          req.gatewayUser = user
        }
        if (
          tokenRevocations &&
          (await tokenRevocations.isAccessTokenRevoked(payload))
        ) {
          const subject =
            payload.sid?.trim() || payload.sub?.trim() || 'unknown'
          await securityAlerts?.safeRecordAlert({
            fingerprint: `gateway-revoked-token:${subject}`,
            ruleCode: 'gateway.revoked_token_reuse',
            severity: 'medium',
            title: 'Access token da bi revoke nhung van duoc su dung',
            summary:
              'Gateway tu choi request vi access token da thu hoi van tiep tuc duoc gui len.',
            userId: payload.sub ?? null,
            username: payload.username ?? null,
            sessionId: payload.sid ?? null,
            ipAddress: resolveClientIp(req),
            resourceType: 'gateway',
            resourceId: subject,
            httpMethod: req.method,
            httpPath: normalizeRequestPath(req.path || req.originalUrl || req.url),
            payload: {
              path: req.originalUrl || req.url,
              reason: 'revoked_access_token',
              tokenSessionId: payload.sid ?? null,
              tokenSubject: payload.sub ?? null,
            },
          })
          throw new Error('revoked_access_token')
        }
        if (user) {
          next()
          return
        }
      } catch {
        // Token invalid – fall through to public/anonymous handling
      }
    }

    // 2. No valid token – check if route is public
    if (isPublicPath(req.path || req.originalUrl || req.url, req.method)) {
      req.gatewayUser = createAnonymousUser(req)
      next()
      return
    }

    // 3. Not public and no valid token → reject
    rejectUnauthorized(req, res)
  }
}

export function attachGatewayUserHeaders(
  req: GatewayRequest,
  setHeader: (name: string, value: string) => void,
): void {
  const user = req.gatewayUser
  if (!user) return

  const internalSecret = process.env.GATEWAY_INTERNAL_SHARED_SECRET
  if (internalSecret) {
    setHeader('x-gateway-internal-secret', internalSecret)
  }

  setHeader('x-gateway-user-id', user.userId)
  setHeader('x-gateway-username', user.username)
  setHeader('x-gateway-roles', user.roles.join(','))
  setHeader('x-gateway-normalized-roles', user.normalizedRoles.join(','))
  setHeader('x-gateway-department', encodeURIComponent(user.department ?? ''))
  setHeader('x-gateway-max-security-level', String(user.maxSecurityLevel))
  setHeader('x-gateway-scope-ma-hv', user.scopeMaHv ?? '')
  setHeader('x-gateway-scope-ma-gv', user.scopeMaGv ?? '')
  setHeader('x-gateway-session-id', user.sessionId ?? '')
  setHeader('x-gateway-access-scope', encodeURIComponent(JSON.stringify(user)))
}
