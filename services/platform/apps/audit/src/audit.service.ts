import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { isAdminLike } from '../../../src/common/access-scope'
import { writeAuditLog } from '../../../src/common/audit-log'
import type { AuthUser } from '../../../src/common/auth.types'
import {
  SecurityAlertsService,
  type SecurityAlertStatus,
} from '../../../src/common/security-alerts.service'
import { PostgresService } from '../../../src/common/postgres.service'

const ALERT_STATUSES: SecurityAlertStatus[] = [
  'open',
  'acknowledged',
  'resolved',
]

@Injectable()
export class AuditService {
  constructor(
    private readonly pg: PostgresService,
    private readonly securityAlerts: SecurityAlertsService,
  ) {}

  private assertCanRead(user: AuthUser) {
    if (!isAdminLike(user.roles)) {
      throw new ForbiddenException('TÃ i khoáº£n hiá»‡n táº¡i khÃ´ng cÃ³ quyá»n xem audit log.')
    }
  }

  private normalizeAlertStatus(status: string): SecurityAlertStatus {
    const normalized = status.trim().toLowerCase() as SecurityAlertStatus
    if (!ALERT_STATUSES.includes(normalized)) {
      throw new BadRequestException('Tráº¡ng thÃ¡i security alert khÃ´ng há»£p lá»‡.')
    }
    return normalized
  }

  async listLogs(
    user: AuthUser,
    filters: {
      status?: string
      action?: string
      resourceType?: string
      userId?: string
      resourceId?: string
      from?: string
      to?: string
      limit?: string
    },
  ) {
    this.assertCanRead(user)
    const params: unknown[] = []
    const clauses: string[] = []

    if (filters.status?.trim()) {
      params.push(filters.status.trim())
      clauses.push(`status = $${params.length}`)
    }
    if (filters.action?.trim()) {
      params.push(filters.action.trim())
      clauses.push(`action = $${params.length}`)
    }
    if (filters.resourceType?.trim()) {
      params.push(filters.resourceType.trim())
      clauses.push(`resource_type = $${params.length}`)
    }
    if (filters.userId?.trim()) {
      params.push(filters.userId.trim())
      clauses.push(`user_id = $${params.length}`)
    }
    if (filters.resourceId?.trim()) {
      params.push(filters.resourceId.trim())
      clauses.push(`resource_id = $${params.length}`)
    }
    if (filters.from?.trim()) {
      params.push(filters.from.trim())
      clauses.push(`created_at >= $${params.length}`)
    }
    if (filters.to?.trim()) {
      params.push(filters.to.trim())
      clauses.push(`created_at <= $${params.length}`)
    }

    const limit = Math.max(1, Math.min(500, Number(filters.limit ?? 50) || 50))
    params.push(limit)

    const { rows } = await this.pg.query(
      `SELECT
         id,
         user_id,
         action,
         resource_type,
         resource_id,
         old_value,
         new_value,
         ip_address::text AS ip_address,
         user_agent,
         status,
         reason,
         created_at
       FROM audit_log
       ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    )
    return rows
  }

  async getLog(user: AuthUser, id: string) {
    this.assertCanRead(user)
    const { rows } = await this.pg.query(
      `SELECT
         id,
         user_id,
         action,
         resource_type,
         resource_id,
         old_value,
         new_value,
         ip_address::text AS ip_address,
         user_agent,
         status,
         reason,
         created_at
       FROM audit_log
       WHERE id = $1`,
      [id],
    )
    return rows[0] ?? null
  }

  async listSecurityAlerts(
    user: AuthUser,
    filters: {
      severity?: string
      status?: string
      ruleCode?: string
      userId?: string
      resourceType?: string
      from?: string
      to?: string
      limit?: string
    },
  ) {
    this.assertCanRead(user)
    return this.securityAlerts.listAlerts(filters)
  }

  async getSecurityAlert(user: AuthUser, id: string) {
    this.assertCanRead(user)
    return this.securityAlerts.getAlert(id)
  }

  async updateSecurityAlertStatus(
    user: AuthUser,
    id: string,
    status: string,
  ) {
    this.assertCanRead(user)
    const nextStatus = this.normalizeAlertStatus(status)
    const current = await this.securityAlerts.getAlert(id)
    if (!current) {
      throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y security alert.')
    }

    const updated = await this.securityAlerts.updateAlertStatus(
      id,
      nextStatus,
      user.userId,
    )
    if (!updated) {
      throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y security alert.')
    }

    try {
      await writeAuditLog({
        userId: user.userId,
        action:
          nextStatus === 'acknowledged'
            ? 'security_alert.acknowledge'
            : nextStatus === 'resolved'
              ? 'security_alert.resolve'
              : 'security_alert.reopen',
        resourceType: 'security_alert',
        resourceId: String(updated.id),
        oldValue: {
          status: current.status,
        },
        newValue: {
          status: updated.status,
        },
        status: 'success',
      })
    } catch {
      // Best-effort audit trail; do not fail the admin action after the alert was updated.
    }

    return updated
  }
}
