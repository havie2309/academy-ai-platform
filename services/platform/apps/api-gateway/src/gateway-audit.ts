import type { NextFunction, Response } from 'express'
import { isAdminLike } from '../../../src/common/access-scope'
import { writeAuditLog } from '../../../src/common/audit-log'
import { RedisService } from '../../../src/common/redis/redis.service'
import { SecurityAlertsService } from '../../../src/common/security-alerts.service'
import { SecurityResponseService } from '../../../src/common/security-response.service'
import { isProtectedPath, type GatewayRequest } from './gateway-auth'
import { normalizeRequestPath, resolveClientIp } from './request-network'

const DENIED_WINDOW_SECONDS = 15 * 60
const DENIED_ALERT_THRESHOLD = 5
const DENIED_AUTO_REVOKE_THRESHOLD = 10
const PRIVILEGED_PROBE_WINDOW_SECONDS = 30 * 60
const PRIVILEGED_PROBE_ALERT_THRESHOLD = 2
const PRIVILEGED_PROBE_CRITICAL_THRESHOLD = 4
const PRIVILEGED_ROUTE_PREFIXES = [
  '/api/etl',
  '/api/users/admin',
  '/api/audit',
  '/api/admin-config',
  '/api/rbac',
  '/api/chat/admin',
]

function normalizePath(pathname: string): string {
  return normalizeRequestPath(pathname)
}

function auditStatus(statusCode: number): 'success' | 'failure' | 'denied' {
  if (statusCode === 401 || statusCode === 403) return 'denied'
  if (statusCode >= 200 && statusCode < 400) return 'success'
  return 'failure'
}

function isDeniedStatus(statusCode: number): boolean {
  return statusCode === 401 || statusCode === 403
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

function isPrivilegedPath(pathname: string): boolean {
  const path = normalizePath(pathname)
  return PRIVILEGED_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix))
}

function subjectInfo(req: GatewayRequest): {
  key: string
  userId: string | null
  username: string | null
  sessionId: string | null
  ipAddress: string | null
} {
  const ipAddress = forwardedIp(req)
  const userId = req.gatewayUser?.userId ?? null

  return {
    key: userId ? `user:${userId}` : `ip:${ipAddress ?? 'unknown'}`,
    userId,
    username: req.gatewayUser?.username ?? null,
    sessionId: req.gatewayUser?.sessionId ?? null,
    ipAddress,
  }
}

async function applyAutoAction(
  securityAlerts: SecurityAlertsService,
  alertId: number,
  action: string,
  execute: () => Promise<boolean>,
  note: string,
) {
  try {
    const applied = await execute()
    await securityAlerts.markAutoAction(alertId, {
      action,
      status: applied ? 'applied' : 'skipped',
      note: applied ? note : 'Khong co thay doi bo sung de ap dung auto action.',
    })
  } catch (error) {
    await securityAlerts.markAutoAction(alertId, {
      action,
      status: 'failed',
      note:
        error instanceof Error ? error.message : 'Khong ap dung duoc auto action.',
    })
  }
}

async function recordDeniedBurstAlert(
  req: GatewayRequest,
  path: string,
  statusCode: number,
  resourceType: string | null,
  resourceId: string | null,
  redis: RedisService,
  securityAlerts: SecurityAlertsService,
  securityResponses: SecurityResponseService,
) {
  const subject = subjectInfo(req)
  const count = await redis.increment(
    `security:gateway:denied-burst:${subject.key}`,
    DENIED_WINDOW_SECONDS,
  )
  if (count < DENIED_ALERT_THRESHOLD) {
    return
  }

  const severity =
    subject.userId && subject.sessionId && count >= DENIED_AUTO_REVOKE_THRESHOLD
      ? 'high'
      : 'medium'
  const alert = await securityAlerts.safeRecordAlert({
    fingerprint: `gateway-denied-burst:${subject.key}`,
    ruleCode: 'gateway.denied_burst',
    severity,
    title: 'Nhieu lan 401/403 tu cung mot user hoac IP',
    summary:
      'Gateway ghi nhan nhieu request bi tu choi trong thoi gian ngan tu cung mot user/IP.',
    userId: subject.userId,
    username: subject.username,
    sessionId: subject.sessionId,
    ipAddress: subject.ipAddress,
    resourceType: resourceType ?? 'gateway',
    resourceId,
    httpMethod: req.method,
    httpPath: path,
    autoAction:
      severity === 'high' && subject.sessionId ? 'revoke_session' : null,
    payload: {
      count,
      path,
      statusCode,
      threshold: DENIED_ALERT_THRESHOLD,
      windowSeconds: DENIED_WINDOW_SECONDS,
    },
  })

  if (
    !alert ||
    severity !== 'high' ||
    !subject.userId ||
    !subject.sessionId
  ) {
    return
  }

  await applyAutoAction(
    securityAlerts,
    alert.id,
    'revoke_session',
    () =>
      securityResponses.revokeSession(subject.sessionId!, {
        alertId: alert.id,
        note: `Detected ${count} denied requests within ${DENIED_WINDOW_SECONDS} seconds.`,
        userId: subject.userId!,
      }),
    `Revoked current session after ${count} denied requests in ${DENIED_WINDOW_SECONDS} seconds.`,
  )
}

async function recordPrivilegedProbeAlert(
  req: GatewayRequest,
  path: string,
  resourceType: string | null,
  resourceId: string | null,
  redis: RedisService,
  securityAlerts: SecurityAlertsService,
  securityResponses: SecurityResponseService,
) {
  if (!isPrivilegedPath(path)) {
    return
  }
  if (req.gatewayUser && isAdminLike(req.gatewayUser.roles)) {
    return
  }

  const subject = subjectInfo(req)
  const count = await redis.increment(
    `security:gateway:privileged-probe:${subject.key}`,
    PRIVILEGED_PROBE_WINDOW_SECONDS,
  )
  if (count < PRIVILEGED_PROBE_ALERT_THRESHOLD) {
    return
  }

  const severity =
    subject.userId && count >= PRIVILEGED_PROBE_CRITICAL_THRESHOLD
      ? 'critical'
      : subject.userId
        ? 'high'
        : 'medium'
  const alert = await securityAlerts.safeRecordAlert({
    fingerprint: `gateway-privileged-probe:${subject.key}`,
    ruleCode: 'gateway.privileged_probe',
    severity,
    title: 'Tai khoan thong thuong dang thu goi endpoint admin hoac ETL',
    summary:
      'Gateway phat hien hanh vi lap lai khi truy cap endpoint dac quyen admin/ETL.',
    userId: subject.userId,
    username: subject.username,
    sessionId: subject.sessionId,
    ipAddress: subject.ipAddress,
    resourceType: resourceType ?? 'gateway',
    resourceId,
    httpMethod: req.method,
    httpPath: path,
    autoAction:
      severity === 'critical'
        ? 'lock_account'
        : severity === 'high' && subject.sessionId
          ? 'revoke_session'
          : null,
    payload: {
      count,
      path,
      threshold: PRIVILEGED_PROBE_ALERT_THRESHOLD,
      windowSeconds: PRIVILEGED_PROBE_WINDOW_SECONDS,
    },
  })

  if (!alert || !subject.userId) {
    return
  }

  if (severity === 'critical') {
    await applyAutoAction(
      securityAlerts,
      alert.id,
      'lock_account',
      () =>
        securityResponses.lockUserAccount(subject.userId!, {
          alertId: alert.id,
          note:
            'Locked account after repeated attempts to call privileged admin/ETL endpoints.',
        }),
      'Locked account and revoked all active sessions after repeated privileged endpoint probes.',
    )
    return
  }

  if (severity === 'high' && subject.sessionId) {
    await applyAutoAction(
      securityAlerts,
      alert.id,
      'revoke_session',
      () =>
        securityResponses.revokeSession(subject.sessionId!, {
          alertId: alert.id,
          note:
            'Revoked current session after repeated attempts to call privileged admin/ETL endpoints.',
          userId: subject.userId!,
        }),
      'Revoked current session after repeated privileged endpoint probes.',
    )
  }
}

async function handleSecuritySignals(
  req: GatewayRequest,
  res: Response,
  path: string,
  resourceType: string | null,
  resourceId: string | null,
  redis: RedisService,
  securityAlerts: SecurityAlertsService,
  securityResponses: SecurityResponseService,
) {
  if (!isDeniedStatus(res.statusCode)) {
    return
  }

  await recordDeniedBurstAlert(
    req,
    path,
    res.statusCode,
    resourceType,
    resourceId,
    redis,
    securityAlerts,
    securityResponses,
  )

  await recordPrivilegedProbeAlert(
    req,
    path,
    resourceType,
    resourceId,
    redis,
    securityAlerts,
    securityResponses,
  )
}

export function createGatewayAuditMiddleware(
  redis: RedisService,
  securityAlerts: SecurityAlertsService,
  securityResponses: SecurityResponseService,
) {
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
      void Promise.allSettled([
        writeAuditLog({
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
        }),
        handleSecuritySignals(
          req,
          res,
          path,
          resourceType,
          resourceId,
          redis,
          securityAlerts,
          securityResponses,
        ),
      ]).catch(() => {})
    })

    next()
  }
}
