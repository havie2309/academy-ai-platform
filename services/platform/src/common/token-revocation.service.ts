import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { JwtPayload } from './auth.types'
import { RedisService } from './redis/redis.service'

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60
const SESSION_REVOKED_PREFIX = 'auth:session:revoked:'
const USER_REVOKED_AFTER_PREFIX = 'auth:user:revoked-after:'

function parseDurationToSeconds(
  raw: string | number | undefined,
  fallback: number,
): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw)
  }

  if (typeof raw !== 'string') {
    return fallback
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return fallback
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed)
  }

  const match = trimmed.match(/^(\d+)\s*([smhd])$/i)
  if (!match) {
    return fallback
  }

  const amount = Number(match[1])
  const unit = match[2].toLowerCase()
  if (!Number.isFinite(amount) || amount <= 0) {
    return fallback
  }

  switch (unit) {
    case 's':
      return amount
    case 'm':
      return amount * 60
    case 'h':
      return amount * 60 * 60
    case 'd':
      return amount * 24 * 60 * 60
    default:
      return fallback
  }
}

function tokenIssuedAtMs(payload: Pick<JwtPayload, 'iat' | 'iat_ms'>): number {
  if (typeof payload.iat_ms === 'number' && Number.isFinite(payload.iat_ms)) {
    return Math.floor(payload.iat_ms)
  }

  if (typeof payload.iat === 'number' && Number.isFinite(payload.iat)) {
    return Math.floor(payload.iat * 1000)
  }

  return 0
}

@Injectable()
export class TokenRevocationService {
  private readonly logger = new Logger(TokenRevocationService.name)

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  private get accessTokenTtlSeconds(): number {
    return parseDurationToSeconds(
      this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ??
        this.config.get<string>('JWT_EXPIRES_IN') ??
        '15m',
      DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
    )
  }

  private get userRevocationTtlSeconds(): number {
    return parseDurationToSeconds(
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ??
        this.config.get<string>('REFRESH_TOKEN_EXPIRES_IN') ??
        DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
      DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
    )
  }

  private revokedSessionKey(sessionId: string): string {
    return `${SESSION_REVOKED_PREFIX}${sessionId}`
  }

  private revokedAfterKey(userId: string): string {
    return `${USER_REVOKED_AFTER_PREFIX}${userId}`
  }

  async isAccessTokenRevoked(
    payload: Pick<JwtPayload, 'sub' | 'sid' | 'iat' | 'iat_ms'>,
  ): Promise<boolean> {
    if (!payload.sub) {
      return true
    }

    try {
      if (payload.sid) {
        const revoked = await this.redis.exists(this.revokedSessionKey(payload.sid))
        if (revoked) {
          return true
        }
      }

      const revokedAfterRaw = await this.redis.get(this.revokedAfterKey(payload.sub))
      if (!revokedAfterRaw) {
        return false
      }

      const revokedAfterMs = Number(revokedAfterRaw)
      if (!Number.isFinite(revokedAfterMs) || revokedAfterMs <= 0) {
        this.logger.warn(
          `Invalid revoke-all marker for user ${payload.sub}; denying access.`,
        )
        return true
      }

      const issuedAtMs = tokenIssuedAtMs(payload)
      if (issuedAtMs <= 0) {
        this.logger.warn(
          `Access token for user ${payload.sub} is missing issue time while revoke-all is active; denying access.`,
        )
        return true
      }

      return issuedAtMs <= revokedAfterMs
    } catch (error) {
      this.logger.warn(
        `Token revocation lookup failed; denying access: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return true
    }
  }

  async revokeAccessForSession(sessionId: string): Promise<void> {
    try {
      await this.redis.set(
        this.revokedSessionKey(sessionId),
        '1',
        this.accessTokenTtlSeconds + 60,
      )
    } catch (error) {
      this.logger.warn(
        `Unable to cache revoked session ${sessionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  async revokeAllAccessForUser(userId: string): Promise<void> {
    try {
      await this.redis.set(
        this.revokedAfterKey(userId),
        String(Date.now()),
        this.userRevocationTtlSeconds + this.accessTokenTtlSeconds + 60,
      )
    } catch (error) {
      this.logger.warn(
        `Unable to cache revoke-all marker for user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}
