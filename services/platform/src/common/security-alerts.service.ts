import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { PostgresService } from './postgres.service'

export type SecurityAlertSeverity = 'low' | 'medium' | 'high' | 'critical'
export type SecurityAlertStatus = 'open' | 'acknowledged' | 'resolved'
export type SecurityAlertAutoActionStatus =
  | 'none'
  | 'applied'
  | 'failed'
  | 'skipped'

export interface SecurityAlertRecord {
  id: number
  fingerprint: string
  rule_code: string
  severity: SecurityAlertSeverity
  status: SecurityAlertStatus
  title: string
  summary: string
  user_id: string | null
  username: string | null
  session_id: string | null
  ip_address: string | null
  resource_type: string | null
  resource_id: string | null
  http_method: string | null
  http_path: string | null
  event_count: number
  first_seen_at: string
  last_seen_at: string
  acknowledged_by: string | null
  acknowledged_at: string | null
  resolved_by: string | null
  resolved_at: string | null
  auto_action: string | null
  auto_action_status: SecurityAlertAutoActionStatus
  auto_action_note: string | null
  payload: unknown
  created_at: string
  updated_at: string
}

export interface SecurityAlertInput {
  fingerprint: string
  ruleCode: string
  severity: SecurityAlertSeverity
  title: string
  summary: string
  userId?: string | null
  username?: string | null
  sessionId?: string | null
  ipAddress?: string | null
  resourceType?: string | null
  resourceId?: string | null
  httpMethod?: string | null
  httpPath?: string | null
  payload?: unknown
  autoAction?: string | null
  autoActionStatus?: SecurityAlertAutoActionStatus
  autoActionNote?: string | null
}

const SEVERITY_RANK: Record<SecurityAlertSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

@Injectable()
export class SecurityAlertsService implements OnModuleInit {
  private readonly logger = new Logger(SecurityAlertsService.name)

  constructor(private readonly pg: PostgresService) {}

  async onModuleInit() {
    await this.ensureSchema()
  }

  private async ensureSchema() {
    await this.pg.query(`
      CREATE TABLE IF NOT EXISTS security_alerts (
        id BIGSERIAL PRIMARY KEY,
        fingerprint VARCHAR(255) NOT NULL UNIQUE,
        rule_code VARCHAR(100) NOT NULL,
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        severity_rank SMALLINT NOT NULL CHECK (severity_rank BETWEEN 1 AND 4),
        status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        user_id VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
        username VARCHAR(100),
        session_id VARCHAR(100),
        ip_address INET,
        resource_type VARCHAR(50),
        resource_id VARCHAR(100),
        http_method VARCHAR(10),
        http_path TEXT,
        event_count INTEGER NOT NULL DEFAULT 1 CHECK (event_count >= 1),
        first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
        acknowledged_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
        acknowledged_at TIMESTAMP,
        resolved_by VARCHAR(20) REFERENCES users(user_id) ON DELETE SET NULL,
        resolved_at TIMESTAMP,
        auto_action VARCHAR(100),
        auto_action_status VARCHAR(20) NOT NULL DEFAULT 'none'
          CHECK (auto_action_status IN ('none', 'applied', 'failed', 'skipped')),
        auto_action_note TEXT,
        payload JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_security_alerts_status_seen
      ON security_alerts (status, last_seen_at DESC)
    `)
    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_security_alerts_severity_seen
      ON security_alerts (severity_rank DESC, last_seen_at DESC)
    `)
    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_security_alerts_user_seen
      ON security_alerts (user_id, last_seen_at DESC)
    `)
    await this.pg.query(`
      CREATE INDEX IF NOT EXISTS idx_security_alerts_rule_seen
      ON security_alerts (rule_code, last_seen_at DESC)
    `)
  }

  async recordAlert(input: SecurityAlertInput): Promise<SecurityAlertRecord> {
    const {
      fingerprint,
      ruleCode,
      severity,
      title,
      summary,
      userId,
      username,
      sessionId,
      ipAddress,
      resourceType,
      resourceId,
      httpMethod,
      httpPath,
      payload,
      autoAction,
      autoActionStatus,
      autoActionNote,
    } = input

    const { rows } = await this.pg.query<SecurityAlertRecord>(
      `
      INSERT INTO security_alerts (
        fingerprint,
        rule_code,
        severity,
        severity_rank,
        status,
        title,
        summary,
        user_id,
        username,
        session_id,
        ip_address,
        resource_type,
        resource_id,
        http_method,
        http_path,
        event_count,
        auto_action,
        auto_action_status,
        auto_action_note,
        payload
      ) VALUES (
        $1, $2, $3, $4, 'open', $5, $6, $7, $8, $9,
        NULLIF($10, '')::inet, $11, $12, $13, $14, 1, $15, $16, $17, $18
      )
      ON CONFLICT (fingerprint) DO UPDATE
      SET
        rule_code = EXCLUDED.rule_code,
        severity = CASE
          WHEN security_alerts.severity_rank >= EXCLUDED.severity_rank
            THEN security_alerts.severity
          ELSE EXCLUDED.severity
        END,
        severity_rank = GREATEST(security_alerts.severity_rank, EXCLUDED.severity_rank),
        status = 'open',
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        user_id = COALESCE(EXCLUDED.user_id, security_alerts.user_id),
        username = COALESCE(EXCLUDED.username, security_alerts.username),
        session_id = COALESCE(EXCLUDED.session_id, security_alerts.session_id),
        ip_address = COALESCE(EXCLUDED.ip_address, security_alerts.ip_address),
        resource_type = COALESCE(EXCLUDED.resource_type, security_alerts.resource_type),
        resource_id = COALESCE(EXCLUDED.resource_id, security_alerts.resource_id),
        http_method = COALESCE(EXCLUDED.http_method, security_alerts.http_method),
        http_path = COALESCE(EXCLUDED.http_path, security_alerts.http_path),
        event_count = security_alerts.event_count + 1,
        last_seen_at = NOW(),
        acknowledged_by = NULL,
        acknowledged_at = NULL,
        resolved_by = NULL,
        resolved_at = NULL,
        auto_action = COALESCE(EXCLUDED.auto_action, security_alerts.auto_action),
        auto_action_status = CASE
          WHEN EXCLUDED.auto_action_status <> 'none' THEN EXCLUDED.auto_action_status
          ELSE security_alerts.auto_action_status
        END,
        auto_action_note = COALESCE(EXCLUDED.auto_action_note, security_alerts.auto_action_note),
        payload = COALESCE(EXCLUDED.payload, security_alerts.payload),
        updated_at = NOW()
      RETURNING
        id,
        fingerprint,
        rule_code,
        severity,
        status,
        title,
        summary,
        user_id,
        username,
        session_id,
        ip_address::text AS ip_address,
        resource_type,
        resource_id,
        http_method,
        http_path,
        event_count,
        first_seen_at::text AS first_seen_at,
        last_seen_at::text AS last_seen_at,
        acknowledged_by,
        acknowledged_at::text AS acknowledged_at,
        resolved_by,
        resolved_at::text AS resolved_at,
        auto_action,
        auto_action_status,
        auto_action_note,
        payload,
        created_at::text AS created_at,
        updated_at::text AS updated_at
      `,
      [
        fingerprint,
        ruleCode,
        severity,
        SEVERITY_RANK[severity],
        title,
        summary,
        userId ?? null,
        username ?? null,
        sessionId ?? null,
        ipAddress ?? null,
        resourceType ?? null,
        resourceId ?? null,
        httpMethod ?? null,
        httpPath ?? null,
        autoAction ?? null,
        autoActionStatus ?? 'none',
        autoActionNote ?? null,
        payload ? JSON.stringify(payload) : null,
      ],
    )

    return rows[0]
  }

  async markAutoAction(
    id: number,
    action: {
      action: string
      status: SecurityAlertAutoActionStatus
      note?: string | null
    },
  ): Promise<void> {
    await this.pg.query(
      `
      UPDATE security_alerts
      SET
        auto_action = $2,
        auto_action_status = $3,
        auto_action_note = $4,
        updated_at = NOW()
      WHERE id = $1
      `,
      [id, action.action, action.status, action.note ?? null],
    )
  }

  async listAlerts(filters: {
    severity?: string
    status?: string
    ruleCode?: string
    userId?: string
    resourceType?: string
    from?: string
    to?: string
    limit?: string
  }): Promise<SecurityAlertRecord[]> {
    const params: unknown[] = []
    const clauses: string[] = []

    if (filters.severity?.trim()) {
      params.push(filters.severity.trim().toLowerCase())
      clauses.push(`severity = $${params.length}`)
    }
    if (filters.status?.trim()) {
      params.push(filters.status.trim().toLowerCase())
      clauses.push(`status = $${params.length}`)
    }
    if (filters.ruleCode?.trim()) {
      params.push(filters.ruleCode.trim())
      clauses.push(`rule_code = $${params.length}`)
    }
    if (filters.userId?.trim()) {
      params.push(filters.userId.trim())
      clauses.push(`user_id = $${params.length}`)
    }
    if (filters.resourceType?.trim()) {
      params.push(filters.resourceType.trim())
      clauses.push(`resource_type = $${params.length}`)
    }
    if (filters.from?.trim()) {
      params.push(filters.from.trim())
      clauses.push(`last_seen_at >= $${params.length}`)
    }
    if (filters.to?.trim()) {
      params.push(filters.to.trim())
      clauses.push(`last_seen_at <= $${params.length}`)
    }

    const limit = Math.max(1, Math.min(500, Number(filters.limit ?? 50) || 50))
    params.push(limit)

    const { rows } = await this.pg.query<SecurityAlertRecord>(
      `
      SELECT
        id,
        fingerprint,
        rule_code,
        severity,
        status,
        title,
        summary,
        user_id,
        username,
        session_id,
        ip_address::text AS ip_address,
        resource_type,
        resource_id,
        http_method,
        http_path,
        event_count,
        first_seen_at::text AS first_seen_at,
        last_seen_at::text AS last_seen_at,
        acknowledged_by,
        acknowledged_at::text AS acknowledged_at,
        resolved_by,
        resolved_at::text AS resolved_at,
        auto_action,
        auto_action_status,
        auto_action_note,
        payload,
        created_at::text AS created_at,
        updated_at::text AS updated_at
      FROM security_alerts
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY severity_rank DESC, last_seen_at DESC
      LIMIT $${params.length}
      `,
      params,
    )
    return rows
  }

  async getAlert(id: string): Promise<SecurityAlertRecord | null> {
    const { rows } = await this.pg.query<SecurityAlertRecord>(
      `
      SELECT
        id,
        fingerprint,
        rule_code,
        severity,
        status,
        title,
        summary,
        user_id,
        username,
        session_id,
        ip_address::text AS ip_address,
        resource_type,
        resource_id,
        http_method,
        http_path,
        event_count,
        first_seen_at::text AS first_seen_at,
        last_seen_at::text AS last_seen_at,
        acknowledged_by,
        acknowledged_at::text AS acknowledged_at,
        resolved_by,
        resolved_at::text AS resolved_at,
        auto_action,
        auto_action_status,
        auto_action_note,
        payload,
        created_at::text AS created_at,
        updated_at::text AS updated_at
      FROM security_alerts
      WHERE id = $1
      `,
      [id],
    )
    return rows[0] ?? null
  }

  async updateAlertStatus(
    id: string,
    status: SecurityAlertStatus,
    actorUserId: string,
  ): Promise<SecurityAlertRecord | null> {
    const { rows } = await this.pg.query<SecurityAlertRecord>(
      `
      UPDATE security_alerts
      SET
        status = $2,
        acknowledged_by = CASE
          WHEN $2 = 'acknowledged' THEN $3
          WHEN $2 = 'open' THEN NULL
          ELSE acknowledged_by
        END,
        acknowledged_at = CASE
          WHEN $2 = 'acknowledged' THEN NOW()
          WHEN $2 = 'open' THEN NULL
          ELSE acknowledged_at
        END,
        resolved_by = CASE
          WHEN $2 = 'resolved' THEN $3
          WHEN $2 = 'open' THEN NULL
          ELSE resolved_by
        END,
        resolved_at = CASE
          WHEN $2 = 'resolved' THEN NOW()
          WHEN $2 = 'open' THEN NULL
          ELSE resolved_at
        END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        fingerprint,
        rule_code,
        severity,
        status,
        title,
        summary,
        user_id,
        username,
        session_id,
        ip_address::text AS ip_address,
        resource_type,
        resource_id,
        http_method,
        http_path,
        event_count,
        first_seen_at::text AS first_seen_at,
        last_seen_at::text AS last_seen_at,
        acknowledged_by,
        acknowledged_at::text AS acknowledged_at,
        resolved_by,
        resolved_at::text AS resolved_at,
        auto_action,
        auto_action_status,
        auto_action_note,
        payload,
        created_at::text AS created_at,
        updated_at::text AS updated_at
      `,
      [id, status, actorUserId],
    )
    return rows[0] ?? null
  }

  async safeRecordAlert(input: SecurityAlertInput): Promise<SecurityAlertRecord | null> {
    try {
      return await this.recordAlert(input)
    } catch (error) {
      this.logger.warn(
        `Unable to persist security alert ${input.ruleCode}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return null
    }
  }
}
