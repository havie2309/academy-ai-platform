import { ForbiddenException, Injectable } from '@nestjs/common'
import { isAdminLike } from '../../../src/common/access-scope'
import type { AuthUser } from '../../../src/common/auth.types'
import { PostgresService } from '../../../src/common/postgres.service'

@Injectable()
export class AuditService {
  constructor(private readonly pg: PostgresService) {}

  private assertCanRead(user: AuthUser) {
    if (!isAdminLike(user.roles)) {
      throw new ForbiddenException('Tài khoản hiện tại không có quyền xem audit log.')
    }
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
}
