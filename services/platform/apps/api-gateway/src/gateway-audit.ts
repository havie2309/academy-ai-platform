import type { NextFunction, Response } from 'express'
import { writeAuditLog } from '../../../src/common/audit-log'
import { isProtectedPath, type GatewayRequest } from './gateway-auth'

function normalizePath(pathname: string): string {
  const clean = pathname.split('?')[0] ?? pathname
  if (clean.length > 1 && clean.endsWith('/')) {
    return clean.slice(0, -1)
  }
  return clean
}

function auditStatus(statusCode: number): 'success' | 'failure' | 'denied' {
  if (statusCode === 401 || statusCode === 403) return 'denied'
  if (statusCode >= 200 && statusCode < 400) return 'success'
  return 'failure'
}

function resourceInfo(pathname: string): {
  resourceType: string | null
  resourceId: string | null
} {
  const segments = normalizePath(pathname)
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (segments[0] !== 'api' || !segments[1]) {
    return { resourceType: null, resourceId: null }
  }

  return {
    resourceType: segments[1],
    resourceId: segments.length > 2 ? segments.slice(2).join('/') : null,
  }
}

function forwardedIp(req: GatewayRequest): string | null {
  const raw = req.headers['x-forwarded-for']
  if (Array.isArray(raw)) {
    return raw[0]?.split(',')[0]?.trim() || null
  }
  return raw?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || null
}

export function createGatewayAuditMiddleware() {
  return (req: GatewayRequest, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') {
      next()
      return
    }

    const path = normalizePath(req.path || req.originalUrl || req.url)
    const shouldAudit = isProtectedPath(path)
    if (!shouldAudit) {
      next()
      return
    }

    res.on('finish', () => {
      const { resourceType, resourceId } = resourceInfo(path)
      const status = auditStatus(res.statusCode)
      void writeAuditLog({
        userId: req.gatewayUser?.userId ?? null,
        action: req.method.toLowerCase(),
        resourceType,
        resourceId,
        newValue: {
          path,
          method: req.method,
          statusCode: res.statusCode,
        },
        ipAddress: forwardedIp(req),
        userAgent: String(req.headers['user-agent'] ?? ''),
        status,
        reason: status === 'success' ? null : `HTTP ${res.statusCode}`,
      }).catch(() => {})
    })

    next()
  }
}
