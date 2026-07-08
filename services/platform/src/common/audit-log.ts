import { getSharedPostgresPool } from './postgres.service'

export interface AuditLogInput {
  userId?: string | null
  action: string
  resourceType?: string | null
  resourceId?: string | null
  oldValue?: unknown
  newValue?: unknown
  ipAddress?: string | null
  userAgent?: string | null
  status?: 'success' | 'failure' | 'denied'
  reason?: string | null
}

export async function writeAuditLog(entry: AuditLogInput): Promise<void> {
  const pool = getSharedPostgresPool()
  // Normalize userId: if it's 'anonymous' or empty, set to null
  const userId = entry.userId && entry.userId !== 'anonymous' ? entry.userId : null
  await pool.query(
    `INSERT INTO audit_log (
       user_id, action, resource_type, resource_id, old_value, new_value,
       ip_address, user_agent, status, reason
     ) VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, '')::inet, $8, $9, $10)`,
    [
      userId,
      entry.action,
      entry.resourceType ?? null,
      entry.resourceId ?? null,
      entry.oldValue ?? null,
      entry.newValue ?? null,
      entry.ipAddress ?? null,
      entry.userAgent ?? null,
      entry.status ?? 'success',
      entry.reason ?? null,
    ],
  )
}
