import type { NextFunction, Response } from 'express'
import type { ConfigService } from '@nestjs/config'
import { SecurityAlertsService } from '../../../src/common/security-alerts.service'
import { isPublicPath, type GatewayRequest } from './gateway-auth'
import {
  normalizeRequestPath,
  parseCsvConfig,
  resolveClientCountry,
  resolveClientIp,
} from './request-network'

interface NetworkPolicyConfig {
  restrictedPaths: string[]
  countryHeader: string
  allowedCountries: Set<string>
  blockedCountries: Set<string>
}

function readListConfig(
  config: ConfigService,
  key: string,
  fallback = '',
): string[] {
  const value = config.get<string | undefined>(key) ?? fallback
  return parseCsvConfig(value)
}

function buildPolicy(config: ConfigService): NetworkPolicyConfig {
  const restrictedPaths = readListConfig(
    config,
    'NETWORK_RESTRICTED_PATHS',
    '/api/etl',
  ).map((path) => normalizeRequestPath(path))
  const allowedCountries = new Set(
    readListConfig(config, 'NETWORK_ALLOWED_COUNTRIES').map((value) =>
      value.toUpperCase(),
    ),
  )
  const blockedCountries = new Set(
    readListConfig(config, 'NETWORK_BLOCKED_COUNTRIES').map((value) =>
      value.toUpperCase(),
    ),
  )

  return {
    restrictedPaths,
    countryHeader:
      config.get<string | undefined>('NETWORK_COUNTRY_HEADER')?.trim().toLowerCase() ||
      'x-geo-country',
    allowedCountries,
    blockedCountries,
  }
}

function matchesRestrictedPath(pathname: string, restrictedPaths: string[]): boolean {
  return restrictedPaths.some((prefix) => pathname.startsWith(prefix))
}

function denyRequest(
  req: GatewayRequest,
  res: Response,
  reason: string,
  clientIp: string | null,
  country: string | null,
  securityAlerts?: SecurityAlertsService,
) {
  const path = normalizeRequestPath(req.path || req.originalUrl || req.url)
  const subject =
    req.gatewayUser?.userId
      ? `user:${req.gatewayUser.userId}`
      : `ip:${clientIp ?? 'unknown'}`

  void securityAlerts?.safeRecordAlert({
    fingerprint: `gateway-network-policy:${reason}:${subject}`,
    ruleCode: 'gateway.network_policy_blocked',
    severity: req.gatewayUser?.userId ? 'medium' : 'low',
    title: 'Gateway chan request boi network policy',
    summary:
      'Gateway tu choi request vi khong dat network policy tren duong dan nhay cam.',
    userId: req.gatewayUser?.userId ?? null,
    username: req.gatewayUser?.username ?? null,
    sessionId: req.gatewayUser?.sessionId ?? null,
    ipAddress: clientIp,
    resourceType: 'gateway',
    resourceId: reason,
    httpMethod: req.method,
    httpPath: path,
    payload: {
      clientIp,
      country,
      path,
      reason,
    },
  })

  console.warn('Gateway network policy denied request', {
    reason,
    path: req.originalUrl || req.url,
    method: req.method,
    userId: req.gatewayUser?.userId ?? null,
    clientIp,
    country,
  })

  res.status(403).json({
    message: 'Yeu cau bi tu choi boi gateway network policy.',
    reason,
  })
}

export function createNetworkPolicyMiddleware(
  config: ConfigService,
  securityAlerts?: SecurityAlertsService,
) {
  const policy = buildPolicy(config)
  const hasCountryPolicy =
    policy.allowedCountries.size > 0 || policy.blockedCountries.size > 0
  const enabled = policy.restrictedPaths.length > 0 && hasCountryPolicy

  return (req: GatewayRequest, res: Response, next: NextFunction) => {
    if (!enabled || req.method === 'OPTIONS') {
      next()
      return
    }

    const path = normalizeRequestPath(req.path || req.originalUrl || req.url)
    if (
      isPublicPath(path, req.method) ||
      !matchesRestrictedPath(path, policy.restrictedPaths)
    ) {
      next()
      return
    }

    const clientIp = resolveClientIp(req)
    const country = resolveClientCountry(req, policy.countryHeader)
    if (!country) {
      denyRequest(
        req,
        res,
        'country_unavailable',
        clientIp,
        null,
        securityAlerts,
      )
      return
    }
    if (policy.blockedCountries.has(country)) {
      denyRequest(
        req,
        res,
        'country_blocked',
        clientIp,
        country,
        securityAlerts,
      )
      return
    }
    if (
      policy.allowedCountries.size > 0 &&
      !policy.allowedCountries.has(country)
    ) {
      denyRequest(
        req,
        res,
        'country_not_allowed',
        clientIp,
        country,
        securityAlerts,
      )
      return
    }

    next()
  }
}
