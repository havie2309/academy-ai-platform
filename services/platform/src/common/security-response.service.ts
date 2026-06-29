import { Injectable, Logger } from '@nestjs/common'
import { writeAuditLog } from './audit-log'
import { PostgresService } from './postgres.service'
import { RedisService } from './redis/redis.service'
import { TokenRevocationService } from './token-revocation.service'

@Injectable()
export class SecurityResponseService {
  private readonly logger = new Logger(SecurityResponseService.name)

  constructor(
    private readonly pg: PostgresService,
    private readonly redis: RedisService,
    private readonly tokenRevocations: TokenRevocationService,
  ) {}

  async revokeSession(
    sessionId: string,
    options?: { userId?: string | null; alertId?: number | null; note?: string | null },
  ): Promise<boolean> {
    if (!sessionId) return false

    const { rowCount } = await this.pg.query(
      `
      UPDATE user_sessions
      SET revoked_at = NOW()
      WHERE session_id = $1
        AND revoked_at IS NULL
      `,
      [sessionId],
    )
    await this.tokenRevocations.revokeAccessForSession(sessionId)
    await this.writeAutoActionAudit('security.auto_revoke_session', {
      targetUserId: options?.userId ?? null,
      sessionId,
      alertId: options?.alertId ?? null,
      note: options?.note ?? null,
    })
    return (rowCount ?? 0) > 0
  }

  async revokeAllSessionsForUser(
    userId: string,
    options?: { alertId?: number | null; note?: string | null },
  ): Promise<number> {
    if (!userId) return 0

    const { rowCount } = await this.pg.query(
      `
      UPDATE user_sessions
      SET revoked_at = NOW()
      WHERE user_id = $1
        AND revoked_at IS NULL
      `,
      [userId],
    )
    await this.tokenRevocations.revokeAllAccessForUser(userId)
    await this.writeAutoActionAudit('security.auto_revoke_all_sessions', {
      targetUserId: userId,
      alertId: options?.alertId ?? null,
      note: options?.note ?? null,
      revokedCount: rowCount ?? 0,
    })
    return rowCount ?? 0
  }

  async temporaryLockUserById(
    userId: string,
    durationSeconds: number,
    options?: { alertId?: number | null; note?: string | null },
  ): Promise<boolean> {
    if (!userId || durationSeconds <= 0) return false

    const username = await this.lookupUsername(userId)
    if (!username) {
      return false
    }

    await this.redis.lockAccount(username, durationSeconds)
    await this.writeAutoActionAudit('security.auto_temporary_lock', {
      targetUserId: userId,
      username,
      alertId: options?.alertId ?? null,
      note: options?.note ?? null,
      durationSeconds,
    })
    return true
  }

  async lockUserAccount(
    userId: string,
    options?: { alertId?: number | null; note?: string | null },
  ): Promise<boolean> {
    if (!userId) return false

    const { rows } = await this.pg.query<{ username: string | null }>(
      `
      UPDATE users
      SET status = 'locked'
      WHERE user_id = $1
      RETURNING username
      `,
      [userId],
    )
    if (!rows[0]) {
      return false
    }

    await this.revokeAllSessionsForUser(userId, options)
    await this.writeAutoActionAudit('security.auto_lock_account', {
      targetUserId: userId,
      username: rows[0].username ?? null,
      alertId: options?.alertId ?? null,
      note: options?.note ?? null,
    })
    return true
  }

  private async lookupUsername(userId: string): Promise<string | null> {
    try {
      const { rows } = await this.pg.query<{ username: string | null }>(
        `SELECT username FROM users WHERE user_id = $1 LIMIT 1`,
        [userId],
      )
      return rows[0]?.username?.trim() || null
    } catch (error) {
      this.logger.warn(
        `Unable to look up username for security response ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return null
    }
  }

  private async writeAutoActionAudit(
    action: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      await writeAuditLog({
        userId: null,
        action,
        resourceType: 'security_alert',
        resourceId:
          typeof payload.alertId === 'number' ? String(payload.alertId) : null,
        newValue: payload,
        status: 'success',
      })
    } catch (error) {
      this.logger.warn(
        `Unable to write audit entry for ${action}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}
