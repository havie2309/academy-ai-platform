import { Injectable, OnModuleInit } from '@nestjs/common'
import { Pool } from 'pg'

@Injectable()
export class UsersService implements OnModuleInit {
  private pool: Pool

  onModuleInit() {
    const postgresHost =
      process.env.POSTGRES_HOST?.trim() === 'localhost'
        ? '127.0.0.1'
        : (process.env.POSTGRES_HOST?.trim() ?? '127.0.0.1')

    this.pool = new Pool({
      host:     postgresHost,
      port:     Number(process.env.POSTGRES_PORT ?? 5432),
      database: process.env.POSTGRES_DB       ?? 'pm2',
      user:     process.env.POSTGRES_USER     ?? 'pm2_user',
      password: process.env.POSTGRES_PASSWORD ?? 'pm2pass',
    })
  }

  async findByUsername(username: string) {
    const { rows: [user] } = await this.pool.query(
      `SELECT u.user_id, u.username, u.email, u.fullname,
              u.department, u.password_hash, u.status, u.max_security_level,
              ARRAY_AGG(r.code) FILTER (WHERE r.code IS NOT NULL) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.user_id AND ur.is_active = true
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.username = $1 AND u.status = 'active'
       GROUP BY u.user_id`,
      [username]
    )
    return user ?? null
  }

  async findById(userId: string) {
    const { rows: [user] } = await this.pool.query(
      `SELECT u.user_id, u.username, u.email, u.fullname,
              u.department, u.max_security_level,
              ARRAY_AGG(r.code) FILTER (WHERE r.code IS NOT NULL) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.user_id AND ur.is_active = true
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.user_id = $1 AND u.status = 'active'
       GROUP BY u.user_id`,
      [userId]
    )
    return user ?? null
  }

  async saveSession(
    userId: string,
    refreshTokenHash: string,
    expiresAt: Date,
    ip: string,
    userAgent: string,
  ) {
    const sessionId = crypto.randomUUID()
    await this.pool.query(
      `INSERT INTO user_sessions (
         session_id, user_id, refresh_token_hash, ip_address, user_agent, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [sessionId, userId, refreshTokenHash, ip, userAgent, expiresAt],
    )
    return sessionId
  }

  async findActiveSessionByRefreshHash(refreshTokenHash: string) {
    const { rows } = await this.pool.query(
      `SELECT session_id, user_id, expires_at
       FROM user_sessions
       WHERE refresh_token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()`,
      [refreshTokenHash],
    )
    return rows[0] ?? null
  }

  async rotateSession(
    sessionId: string,
    refreshTokenHash: string,
    expiresAt: Date,
    ip: string,
    userAgent: string,
  ) {
    await this.pool.query(
      `UPDATE user_sessions
       SET refresh_token_hash = $2,
           expires_at = $3,
           ip_address = $4,
           user_agent = $5,
           last_refreshed_at = NOW()
       WHERE session_id = $1`,
      [sessionId, refreshTokenHash, expiresAt, ip, userAgent],
    )
  }

  async revokeSessionByRefreshHash(refreshTokenHash: string) {
    await this.pool.query(
      `UPDATE user_sessions SET revoked_at = NOW()
       WHERE refresh_token_hash = $1 AND revoked_at IS NULL`,
      [refreshTokenHash],
    )
  }

  async revokeAllSessions(userId: string) {
    await this.pool.query(
      `UPDATE user_sessions SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    )
  }

  async logLogin(userId: string, event: string, ip: string, userAgent: string, success: boolean, reason?: string) {
    await this.pool.query(
      `INSERT INTO login_logs (user_id, event_type, ip_address, user_agent, success, failure_reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, event, ip, userAgent, success, reason ?? null]
    )
  }

  async updateLastLogin(userId: string) {
    await this.pool.query(
      `UPDATE users SET last_login_at = NOW() WHERE user_id = $1`,
      [userId]
    )
  }
}
