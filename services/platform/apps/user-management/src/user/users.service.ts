import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Collection, Db, MongoClient } from 'mongodb'
import { Pool } from 'pg'
import { RedisService } from '../../../../src/common/redis/redis.service'

const ADMIN_MANAGEMENT_ROLES = ['ADMIN', 'BGD', 'P2', 'P7']
const REFRESH_TTL_DAYS = 7
const LOGIN_LOCK_DURATION_SECONDS = 900

type UserStatus = 'active' | 'inactive' | 'locked'

interface AccountRow {
  user_id: string
  username: string
  email: string
  fullname: string | null
  department: string | null
  max_security_level: number
  status: UserStatus
  last_login_at: Date | null
  roles: string[] | null
  active_refresh_sessions: number
  last_refreshed_at: Date | null
  failed_logins_7d: number
  refreshes_7d: number
}

interface ChatUsage {
  chatSessionsTotal: number
  chatMessages30d: number
  lastChatAt: Date | null
}

@Injectable()
export class UsersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UsersService.name)
  private pool!: Pool
  private mongoClient: MongoClient | null = null
  private mongoDb: Db | null = null
  private chatSessions: Collection | null = null
  private chatMessages: Collection | null = null
  private warnedMongoUnavailable = false

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
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

    await this.ensureMongoReady()
  }

  async findByUsername(username: string) {
    const { rows: [user] } = await this.pool.query(
      `SELECT u.user_id, u.username, u.email, u.fullname,
              u.department, u.password_hash, u.password_salt,
              u.hash_iterations, u.hash_algorithm, u.status, u.max_security_level,
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

  async getAdminOverview() {
    const [
      accountSummary,
      tokenSummary,
      authSummary,
      chatSummary,
      transientLocks,
    ] = await Promise.all([
      this.pool.query(
        `SELECT
           COUNT(*)::int AS total_users,
           COUNT(*) FILTER (WHERE status = 'active')::int AS active_users,
           COUNT(*) FILTER (WHERE status = 'inactive')::int AS inactive_users,
           COUNT(*) FILTER (WHERE status = 'locked')::int AS locked_users,
           COUNT(*) FILTER (
             WHERE EXISTS (
               SELECT 1
               FROM user_roles ur
               JOIN roles r ON r.id = ur.role_id
               WHERE ur.user_id = u.user_id
                 AND ur.is_active = TRUE
                 AND r.code = ANY($1::text[])
             )
           )::int AS admin_like_users
         FROM users u`,
        [ADMIN_MANAGEMENT_ROLES],
      ),
      this.pool.query(
        `SELECT
           COUNT(*) FILTER (
             WHERE revoked_at IS NULL
               AND expires_at > NOW()
           )::int AS active_refresh_sessions,
           COUNT(*) FILTER (
             WHERE revoked_at IS NULL
               AND expires_at > NOW()
               AND expires_at <= NOW() + INTERVAL '24 hours'
           )::int AS sessions_expiring_24h,
           COUNT(*) FILTER (
             WHERE revoked_at IS NOT NULL
               AND revoked_at >= NOW() - INTERVAL '24 hours'
           )::int AS revoked_sessions_24h
         FROM user_sessions`,
      ),
      this.pool.query(
        `SELECT
           COUNT(*) FILTER (
             WHERE event_type = 'token_refresh'
               AND created_at >= NOW() - INTERVAL '24 hours'
           )::int AS refreshes_24h,
           COUNT(*) FILTER (
             WHERE event_type = 'login_failed'
               AND created_at >= NOW() - INTERVAL '24 hours'
           )::int AS failed_logins_24h,
           COUNT(*) FILTER (
             WHERE event_type = 'login_success'
               AND created_at >= NOW() - INTERVAL '24 hours'
           )::int AS successful_logins_24h
         FROM login_logs`,
      ),
      this.getChatUsageOverview(),
      this.getTemporaryLockState(),
    ])

    const account = accountSummary.rows[0]
    const tokens = tokenSummary.rows[0]
    const auth = authSummary.rows[0]

    return {
      generated_at: new Date().toISOString(),
      quota_policy: {
        rate_limit_auth_per_minute: Number(process.env.RATE_LIMIT_AUTH ?? 60),
        rate_limit_anon_per_minute: Number(process.env.RATE_LIMIT_ANON ?? 10),
        load_shedding_max_concurrent: Number(
          process.env.LOAD_SHEDDING_MAX_CONCURRENT ?? 100,
        ),
        access_token_ttl: process.env.JWT_ACCESS_EXPIRES_IN ??
          process.env.JWT_EXPIRES_IN ??
          '15m',
        refresh_token_ttl_days: REFRESH_TTL_DAYS,
        login_max_attempts: Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5),
        login_lock_duration_seconds: Number(
          process.env.LOGIN_LOCK_DURATION ?? LOGIN_LOCK_DURATION_SECONDS,
        ),
      },
      account_summary: {
        total_users: account?.total_users ?? 0,
        active_users: account?.active_users ?? 0,
        inactive_users: account?.inactive_users ?? 0,
        locked_users: account?.locked_users ?? 0,
        admin_like_users: account?.admin_like_users ?? 0,
        temporary_locked_users: transientLocks.usernames.size,
      },
      token_summary: {
        active_refresh_sessions: tokens?.active_refresh_sessions ?? 0,
        sessions_expiring_24h: tokens?.sessions_expiring_24h ?? 0,
        refreshes_24h: auth?.refreshes_24h ?? 0,
        revoked_sessions_24h: tokens?.revoked_sessions_24h ?? 0,
      },
      usage_summary: {
        failed_logins_24h: auth?.failed_logins_24h ?? 0,
        successful_logins_24h: auth?.successful_logins_24h ?? 0,
        chat_sessions_7d: chatSummary.chatSessions7d,
        chat_messages_7d: chatSummary.chatMessages7d,
        active_chat_users_7d: chatSummary.activeChatUsers7d,
      },
      sources: {
        mongo_available: chatSummary.available,
        redis_available: transientLocks.available,
      },
    }
  }

  async listManagedAccounts(filters: {
    search?: string
    status?: UserStatus
    role?: string
    limit?: number
  }) {
    const params: unknown[] = []
    const where: string[] = []

    if (filters.search?.trim()) {
      params.push(`%${filters.search.trim()}%`)
      const idx = params.length
      where.push(
        `(u.username ILIKE $${idx} OR u.email ILIKE $${idx} OR COALESCE(u.fullname, '') ILIKE $${idx} OR COALESCE(u.department, '') ILIKE $${idx})`,
      )
    }

    if (filters.status) {
      params.push(filters.status)
      where.push(`u.status = $${params.length}`)
    }

    if (filters.role?.trim()) {
      params.push(filters.role.trim().toUpperCase())
      where.push(
        `EXISTS (
          SELECT 1
          FROM user_roles ur2
          JOIN roles r2 ON r2.id = ur2.role_id
          WHERE ur2.user_id = u.user_id
            AND ur2.is_active = TRUE
            AND r2.code = $${params.length}
        )`,
      )
    }

    const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100)
    params.push(limit)

    const { rows } = await this.pool.query<AccountRow>(
      `SELECT
         u.user_id,
         u.username,
         u.email,
         u.fullname,
         u.department,
         u.max_security_level,
         u.status,
         u.last_login_at,
         role_stats.roles,
         COALESCE(session_stats.active_refresh_sessions, 0)::int AS active_refresh_sessions,
         session_stats.last_refreshed_at,
         COALESCE(log_stats.failed_logins_7d, 0)::int AS failed_logins_7d,
         COALESCE(log_stats.refreshes_7d, 0)::int AS refreshes_7d
       FROM users u
       LEFT JOIN LATERAL (
         SELECT ARRAY_AGG(r.code ORDER BY r.code) FILTER (WHERE r.code IS NOT NULL) AS roles
         FROM user_roles ur
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = u.user_id
           AND ur.is_active = TRUE
       ) role_stats ON TRUE
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*) FILTER (
             WHERE revoked_at IS NULL
               AND expires_at > NOW()
           )::int AS active_refresh_sessions,
           MAX(last_refreshed_at) AS last_refreshed_at
         FROM user_sessions s
         WHERE s.user_id = u.user_id
       ) session_stats ON TRUE
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*) FILTER (
             WHERE event_type = 'login_failed'
               AND created_at >= NOW() - INTERVAL '7 days'
           )::int AS failed_logins_7d,
           COUNT(*) FILTER (
             WHERE event_type = 'token_refresh'
               AND created_at >= NOW() - INTERVAL '7 days'
           )::int AS refreshes_7d
         FROM login_logs l
         WHERE l.user_id = u.user_id
       ) log_stats ON TRUE
       WHERE ${where.length > 0 ? where.join(' AND ') : 'TRUE'}
       ORDER BY
         CASE u.status
           WHEN 'locked' THEN 0
           WHEN 'active' THEN 1
           ELSE 2
         END,
         u.last_login_at DESC NULLS LAST,
         u.username ASC
       LIMIT $${params.length}`,
      params,
    )

    const transientLocks = await this.getTemporaryLockState()
    const userIds = rows.map((row) => row.user_id)
    const chatUsage = await this.getChatUsageByUserIds(userIds)

    return rows.map((row) => {
      const usage = chatUsage.get(row.user_id) ?? {
        chatSessionsTotal: 0,
        chatMessages30d: 0,
        lastChatAt: null,
      }

      return {
        user_id: row.user_id,
        username: row.username,
        email: row.email,
        full_name: row.fullname,
        department: row.department,
        max_security_level: row.max_security_level,
        status: row.status,
        roles: row.roles ?? [],
        last_login_at: row.last_login_at?.toISOString() ?? null,
        temporary_locked: transientLocks.usernames.has(row.username),
        active_refresh_sessions: row.active_refresh_sessions ?? 0,
        last_refreshed_at: row.last_refreshed_at?.toISOString() ?? null,
        failed_logins_7d: row.failed_logins_7d ?? 0,
        refreshes_7d: row.refreshes_7d ?? 0,
        chat_sessions_total: usage.chatSessionsTotal,
        chat_messages_30d: usage.chatMessages30d,
        last_chat_at: usage.lastChatAt?.toISOString() ?? null,
      }
    })
  }

  async updateManagedAccountStatus(
    targetUserId: string,
    nextStatus: UserStatus,
    actorUserId: string,
  ) {
    if (targetUserId === actorUserId && nextStatus !== 'active') {
      throw new Error('Không thể tự khóa hoặc tự vô hiệu hóa tài khoản đang dùng.')
    }

    const { rows: [updated] } = await this.pool.query<{
      user_id: string
      username: string
      status: UserStatus
    }>(
      `UPDATE users
       SET status = $2,
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING user_id, username, status`,
      [targetUserId, nextStatus],
    )

    if (!updated) {
      throw new Error('Không tìm thấy tài khoản cần cập nhật.')
    }

    let revokedCount = 0
    if (nextStatus !== 'active') {
      revokedCount = await this.revokeAllSessionsForUser(targetUserId)
    } else {
      await this.redis.resetFailedAttempts(updated.username)
    }

    const [account] = await this.listManagedAccounts({ search: updated.username, limit: 1 })

    return {
      message:
        nextStatus === 'active'
          ? 'Đã kích hoạt và gỡ khóa tạm thời cho tài khoản.'
          : 'Đã cập nhật trạng thái tài khoản.',
      revoked_count: revokedCount,
      account,
    }
  }

  async revokeManagedAccountSessions(targetUserId: string) {
    const account = await this.getManagedAccountById(targetUserId)
    if (!account) {
      throw new Error('Không tìm thấy tài khoản cần thu hồi phiên.')
    }

    const revokedCount = await this.revokeAllSessionsForUser(targetUserId)

    return {
      message:
        revokedCount > 0
          ? `Đã thu hồi ${revokedCount} phiên đang hoạt động.`
          : 'Tài khoản hiện không có phiên hoạt động để thu hồi.',
      revoked_count: revokedCount,
      account: await this.getManagedAccountById(targetUserId),
    }
  }

  private async getManagedAccountById(userId: string) {
    const { rows } = await this.pool.query<AccountRow>(
      `SELECT
         u.user_id,
         u.username,
         u.email,
         u.fullname,
         u.department,
         u.max_security_level,
         u.status,
         u.last_login_at,
         role_stats.roles,
         COALESCE(session_stats.active_refresh_sessions, 0)::int AS active_refresh_sessions,
         session_stats.last_refreshed_at,
         COALESCE(log_stats.failed_logins_7d, 0)::int AS failed_logins_7d,
         COALESCE(log_stats.refreshes_7d, 0)::int AS refreshes_7d
       FROM users u
       LEFT JOIN LATERAL (
         SELECT ARRAY_AGG(r.code ORDER BY r.code) FILTER (WHERE r.code IS NOT NULL) AS roles
         FROM user_roles ur
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = u.user_id
           AND ur.is_active = TRUE
       ) role_stats ON TRUE
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*) FILTER (
             WHERE revoked_at IS NULL
               AND expires_at > NOW()
           )::int AS active_refresh_sessions,
           MAX(last_refreshed_at) AS last_refreshed_at
         FROM user_sessions s
         WHERE s.user_id = u.user_id
       ) session_stats ON TRUE
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*) FILTER (
             WHERE event_type = 'login_failed'
               AND created_at >= NOW() - INTERVAL '7 days'
           )::int AS failed_logins_7d,
           COUNT(*) FILTER (
             WHERE event_type = 'token_refresh'
               AND created_at >= NOW() - INTERVAL '7 days'
           )::int AS refreshes_7d
         FROM login_logs l
         WHERE l.user_id = u.user_id
       ) log_stats ON TRUE
       WHERE u.user_id = $1
       LIMIT 1`,
      [userId],
    )

    const row = rows[0]
    if (!row) return null

    const transientLocks = await this.getTemporaryLockState()
    const usage = (await this.getChatUsageByUserIds([userId])).get(userId) ?? {
      chatSessionsTotal: 0,
      chatMessages30d: 0,
      lastChatAt: null,
    }

    return {
      user_id: row.user_id,
      username: row.username,
      email: row.email,
      full_name: row.fullname,
      department: row.department,
      max_security_level: row.max_security_level,
      status: row.status,
      roles: row.roles ?? [],
      last_login_at: row.last_login_at?.toISOString() ?? null,
      temporary_locked: transientLocks.usernames.has(row.username),
      active_refresh_sessions: row.active_refresh_sessions ?? 0,
      last_refreshed_at: row.last_refreshed_at?.toISOString() ?? null,
      failed_logins_7d: row.failed_logins_7d ?? 0,
      refreshes_7d: row.refreshes_7d ?? 0,
      chat_sessions_total: usage.chatSessionsTotal,
      chat_messages_30d: usage.chatMessages30d,
      last_chat_at: usage.lastChatAt?.toISOString() ?? null,
    }
  }

  private async revokeAllSessionsForUser(userId: string): Promise<number> {
    const result = await this.pool.query(
      `UPDATE user_sessions
       SET revoked_at = NOW()
       WHERE user_id = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()`,
      [userId],
    )
    return result.rowCount ?? 0
  }

  private async ensureMongoReady(): Promise<boolean> {
    if (this.mongoDb && this.chatSessions && this.chatMessages) {
      return true
    }

    try {
      const mongoHost =
        this.config.get<string>('MONGO_HOST')?.trim() === 'localhost'
          ? '127.0.0.1'
          : (this.config.get<string>('MONGO_HOST')?.trim() ?? '127.0.0.1')

      const uri =
        this.config.get<string>('MONGO_URI') ??
        `mongodb://${this.config.get('MONGO_USER', 'pm2_user')}:${this.config.get('MONGO_PASSWORD', 'pm2pass')}@${mongoHost}:${this.config.get('MONGO_PORT', '27017')}/${this.config.get('MONGO_DB', 'pm2')}?authSource=admin`

      this.mongoClient = new MongoClient(uri)
      await this.mongoClient.connect()
      this.mongoDb = this.mongoClient.db(this.config.get('MONGO_DB', 'pm2'))
      this.chatSessions = this.mongoDb.collection('chat_sessions')
      this.chatMessages = this.mongoDb.collection('chat_messages')
      this.warnedMongoUnavailable = false
      return true
    } catch (error) {
      if (!this.warnedMongoUnavailable) {
        this.logger.warn(
          `Mongo unavailable for admin usage stats: ${error instanceof Error ? error.message : error}`,
        )
        this.warnedMongoUnavailable = true
      }
      this.mongoClient = null
      this.mongoDb = null
      this.chatSessions = null
      this.chatMessages = null
      return false
    }
  }

  private async getChatUsageOverview() {
    const ready = await this.ensureMongoReady()
    if (!ready || !this.chatSessions || !this.chatMessages) {
      return {
        available: false,
        chatSessions7d: 0,
        chatMessages7d: 0,
        activeChatUsers7d: 0,
      }
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    try {
      const [chatSessions7d, chatMessages7d, activeUsers] = await Promise.all([
        this.chatSessions.countDocuments({ updatedAt: { $gte: since } }),
        this.chatMessages.countDocuments({ createdAt: { $gte: since } }),
        this.chatMessages
          .aggregate([
            { $match: { createdAt: { $gte: since } } },
            { $group: { _id: '$userId' } },
            { $count: 'value' },
          ])
          .toArray(),
      ])

      return {
        available: true,
        chatSessions7d,
        chatMessages7d,
        activeChatUsers7d: activeUsers[0]?.value ?? 0,
      }
    } catch (error) {
      this.logger.warn(
        `Unable to compute chat usage overview: ${error instanceof Error ? error.message : error}`,
      )
      return {
        available: false,
        chatSessions7d: 0,
        chatMessages7d: 0,
        activeChatUsers7d: 0,
      }
    }
  }

  private async getChatUsageByUserIds(userIds: string[]) {
    const usage = new Map<string, ChatUsage>()
    if (userIds.length === 0) return usage

    const ready = await this.ensureMongoReady()
    if (!ready || !this.chatSessions || !this.chatMessages) {
      return usage
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    try {
      const [sessionRows, messageRows] = await Promise.all([
        this.chatSessions
          .aggregate([
            { $match: { userId: { $in: userIds } } },
            {
              $group: {
                _id: '$userId',
                chatSessionsTotal: { $sum: 1 },
                lastChatAt: { $max: '$updatedAt' },
              },
            },
          ])
          .toArray(),
        this.chatMessages
          .aggregate([
            {
              $match: {
                userId: { $in: userIds },
                createdAt: { $gte: since },
              },
            },
            {
              $group: {
                _id: '$userId',
                chatMessages30d: { $sum: 1 },
                lastMessageAt: { $max: '$createdAt' },
              },
            },
          ])
          .toArray(),
      ])

      for (const row of sessionRows) {
        usage.set(String(row._id), {
          chatSessionsTotal: Number(row.chatSessionsTotal ?? 0),
          chatMessages30d: 0,
          lastChatAt: row.lastChatAt ?? null,
        })
      }

      for (const row of messageRows) {
        const key = String(row._id)
        const existing = usage.get(key) ?? {
          chatSessionsTotal: 0,
          chatMessages30d: 0,
          lastChatAt: null,
        }
        const lastMessageAt = row.lastMessageAt ?? null
        usage.set(key, {
          chatSessionsTotal: existing.chatSessionsTotal,
          chatMessages30d: Number(row.chatMessages30d ?? 0),
          lastChatAt:
            existing.lastChatAt && lastMessageAt
              ? (existing.lastChatAt > lastMessageAt
                  ? existing.lastChatAt
                  : lastMessageAt)
              : (existing.lastChatAt ?? lastMessageAt),
        })
      }
    } catch (error) {
      this.logger.warn(
        `Unable to compute chat usage by user: ${error instanceof Error ? error.message : error}`,
      )
    }

    return usage
  }

  private async getTemporaryLockState() {
    try {
      const keys = await this.redis.keys('login:locked:*')
      const usernames = new Set(
        keys
          .map((key) => key.replace('login:locked:', '').trim())
          .filter(Boolean),
      )
      return { usernames, available: true }
    } catch {
      return { usernames: new Set<string>(), available: false }
    }
  }

  async onModuleDestroy() {
    await this.mongoClient?.close().catch(() => {})
    await this.pool?.end().catch(() => {})
  }
}
