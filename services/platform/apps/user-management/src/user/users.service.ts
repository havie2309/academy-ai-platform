import { Injectable, OnModuleInit } from '@nestjs/common'
import { Pool } from 'pg'

@Injectable()
export class UsersService implements OnModuleInit {
  private pool: Pool

  onModuleInit() {
    this.pool = new Pool({
      host:     process.env.POSTGRES_HOST     ?? 'localhost',
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

  async saveSession(userId: string, token: string, expiresAt: Date, ip: string, userAgent: string) {
    const sessionId = crypto.randomUUID()
    await this.pool.query(
      `INSERT INTO user_sessions (session_id, user_id, token, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sessionId, userId, token, ip, userAgent, expiresAt]
    )
    return sessionId
  }

  async revokeSession(token: string) {
    await this.pool.query(
      `UPDATE user_sessions SET revoked_at = NOW() WHERE token = $1`,
      [token]
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