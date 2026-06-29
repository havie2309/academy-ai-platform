import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../../src/common/redis/redis.service';
import { SecurityAlertsService } from '../../../src/common/security-alerts.service';
import { ConfigService } from '@nestjs/config';
import { GatewayRequest, GatewayUser } from './gateway-auth';
import { normalizeRequestPath, resolveClientIp } from './request-network';

const DEFAULT_ROLE_LIMITS: Record<string, number> = {
  ADMIN: 180,
  BGD: 180,
  P2: 120,
  P7: 90,
  GIANG_VIEN: 90,
  HOC_VIEN: 60,
};

const ROLE_LIMIT_PRIORITY = [
  'ADMIN',
  'BGD',
  'P2',
  'P7',
  'GIANG_VIEN',
  'HOC_VIEN',
];

export interface RateLimitPolicy {
  key: string;
  limit: number;
  policy: string;
  window: number;
}

function readNumberConfig(
  config: ConfigService,
  key: string,
  fallback: number,
): number {
  const value = config.get<string | number | undefined>(key);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function isAnonymousGatewayUser(user?: GatewayUser): boolean {
  return (
    !user ||
    user.userId === 'anonymous' ||
    user.normalizedRoles.includes('ANONYMOUS')
  );
}

function resolveClientIdentifier(req: Request): string {
  return resolveClientIp(req) ?? 'unknown';
}

function resolveRolePolicy(
  config: ConfigService,
  user: GatewayUser,
  fallbackLimit: number,
): { policy: string; limit: number } {
  const normalizedRoles = Array.from(
    new Set(user.normalizedRoles.filter((role) => role !== 'ANONYMOUS')),
  );

  for (const role of ROLE_LIMIT_PRIORITY) {
    if (!normalizedRoles.includes(role)) continue;
    return {
      policy: role,
      limit: readNumberConfig(
        config,
        `RATE_LIMIT_ROLE_${role}`,
        DEFAULT_ROLE_LIMITS[role] ?? fallbackLimit,
      ),
    };
  }

  for (const role of normalizedRoles) {
    const configured = config.get<string | number | undefined>(
      `RATE_LIMIT_ROLE_${role}`,
    );
    if (configured === undefined || configured === null || configured === '') {
      continue;
    }
    return {
      policy: role,
      limit: readNumberConfig(config, `RATE_LIMIT_ROLE_${role}`, fallbackLimit),
    };
  }

  return {
    policy: 'AUTHENTICATED',
    limit: fallbackLimit,
  };
}

export function resolveRateLimitPolicy(
  req: Request,
  user: GatewayUser | undefined,
  config: ConfigService,
): RateLimitPolicy {
  const window = readNumberConfig(config, 'RATE_LIMIT_WINDOW', 60);
  if (!user || isAnonymousGatewayUser(user)) {
    const identifier = resolveClientIdentifier(req);
    return {
      key: `rate:anonymous:${identifier}`,
      limit: readNumberConfig(config, 'RATE_LIMIT_ANON', 10),
      policy: 'ANONYMOUS',
      window,
    };
  }

  const authFallback = readNumberConfig(config, 'RATE_LIMIT_AUTH', 60);
  const { limit, policy } = resolveRolePolicy(config, user, authFallback);
  return {
    key: `rate:${policy.toLowerCase()}:${user.userId}`,
    limit,
    policy,
    window,
  };
}

export function createRateLimitMiddleware(
  redis: RedisService,
  config: ConfigService,
  securityAlerts?: SecurityAlertsService,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const gatewayReq = req as GatewayRequest;
    const user = gatewayReq.gatewayUser;
    const { key, limit, policy, window } = resolveRateLimitPolicy(
      req,
      user,
      config,
    );

    try {
      const count = await redis.increment(key, window);
      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(limit - count, 0)));
      res.setHeader('X-RateLimit-Policy', policy);

      if (count > limit) {
        const ttl = await redis.ttl(key).catch(() => window);
        const retryAfter = ttl > 0 ? ttl : window;
        res.setHeader('Retry-After', String(retryAfter));
        void securityAlerts?.safeRecordAlert({
          fingerprint: `gateway-rate-limit:${
            user?.userId ? `user:${user.userId}` : `ip:${resolveClientIdentifier(req)}`
          }:${policy.toLowerCase()}`,
          ruleCode: 'gateway.rate_limit_hit',
          severity: isAnonymousGatewayUser(user) ? 'low' : 'medium',
          title: 'Gateway da kich hoat rate limit',
          summary:
            'Request bi chan boi rate limit tai gateway do vuot nguong trong cua so hien tai.',
          userId: user?.userId ?? null,
          username: user?.username ?? null,
          sessionId: user?.sessionId ?? null,
          ipAddress: resolveClientIp(req),
          resourceType: 'gateway',
          resourceId: policy,
          httpMethod: req.method,
          httpPath: normalizeRequestPath(req.path || req.originalUrl || req.url),
          payload: {
            count,
            key,
            limit,
            policy,
            retryAfter,
            window,
          },
        });
        res.status(429).json({
          message: 'Qua nhieu yeu cau. Vui long thu lai sau.',
          retryAfter,
          limit,
          policy,
        });
        return;
      }
    } catch (error) {
      // Redis error - allow the request but log the issue.
      console.error('Rate limit error:', error);
    }

    next();
  };
}
