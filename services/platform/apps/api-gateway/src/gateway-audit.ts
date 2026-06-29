import type { NextFunction, Response } from 'express'
import { writeAuditLog } from '../../../src/common/audit-log'
import { isProtectedPath, type GatewayRequest } from './gateway-auth'
import { normalizeRequestPath, resolveClientIp } from './request-network'

function normalizePath(pathname: string): string {
  return normalizeRequestPath(pathname)
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
  return resolveClientIp(req)
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
