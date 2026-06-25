import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService, JwtSignOptions } from '@nestjs/jwt'
import { compare } from 'bcrypt'
import { pbkdf2Sync } from 'node:crypto'
import { RedisService } from '../../../../src/common/redis/redis.service'
import { ADMIN_MANAGEMENT_ROLES } from '../user/admin-management-roles'
import { UsersService } from '../user/users.service'
import { generateRefreshToken, hashRefreshToken } from './auth.tokens'

function verifyPbkdf2Password(
  password: string,
  hash: string,
  salt: string,
  iterations: number,
  digest: string,
): boolean {
  const computed = pbkdf2Sync(
    password,
    salt,
    iterations,
    hash.length / 2,
    digest,
  ).toString('hex')
  return computed === hash
}

const REFRESH_TTL_DAYS = 7

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  // ============================================================
  // CONFIG GETTERS
  // ============================================================

  private get maxFailedAttempts(): number {
    return this.config.get<number>('LOGIN_MAX_ATTEMPTS', 5)
  }

  private get lockDuration(): number {
    return this.config.get<number>('LOGIN_LOCK_DURATION', 900)
  }

  private get lockWindow(): number {
    return this.config.get<number>('LOGIN_LOCK_WINDOW', 900)
  }

  private get adminBypassRoles(): string[] {
    const raw = this.config.get<string>(
      'LOGIN_ADMIN_BYPASS_ROLES',
      ADMIN_MANAGEMENT_ROLES.join(','),
    )
    return raw
      .split(',')
      .map((r) => r.trim().toUpperCase())
      .filter(Boolean)
  }

  private accessExpiresIn(): string {
    return this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m')
  }

  private refreshExpiresAt(): Date {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS)
    return expiresAt
  }

  private signAccessToken(user: {
    user_id: string
    username: string
    roles?: string[]
    department?: string | null
    max_security_level?: number
  }) {
    const payload = {
      sub: user.user_id,
      username: user.username,
      roles: user.roles ?? [],
      department: user.department ?? null,
      max_security_level: user.max_security_level ?? 1,
    }
    return this.jwt.sign(payload, {
      expiresIn: this.accessExpiresIn() as JwtSignOptions['expiresIn'],
    })
  }

  private toUserDto(user: {
    user_id: string
    username: string
    fullname?: string | null
    roles?: string[]
    department?: string | null
  }) {
    return {
      id: user.user_id,
      username: user.username,
      full_name: user.fullname,
      roles: user.roles ?? [],
      unit_id: user.department ?? null,
    }
  }

  private normalizePbkdf2Digest(hashAlgorithm?: string | null): string | null {
    if (!hashAlgorithm) return null
    const normalized = hashAlgorithm.trim().toLowerCase()
    if (!normalized) return null
    if (normalized.startsWith('pbkdf2_')) {
      return normalized.slice('pbkdf2_'.length) || null
    }
    return normalized
  }

  private async isPasswordValid(
    user: {
      password_hash?: string | null
      password_salt?: string | null
      hash_iterations?: number | null
      hash_algorithm?: string | null
    },
    password: string,
  ): Promise<boolean> {
    if (!user.password_hash) return false

    const digest = this.normalizePbkdf2Digest(user.hash_algorithm)
    if (
      user.password_salt &&
      typeof user.hash_iterations === 'number' &&
      user.hash_iterations > 0 &&
      digest
    ) {
      return verifyPbkdf2Password(
        password,
        user.password_hash,
        user.password_salt,
        user.hash_iterations,
        digest,
      )
    }

    if (/^\$2[aby]\$\d{2}\$/.test(user.password_hash)) {
      return compare(password, user.password_hash)
    }

    return false
  }

  async login(username: string, password: string, ip: string, userAgent: string) {
    const user = await this.users.findByUsername(username)
    const isAdmin = user && this.isAdmin(user)

    if (!isAdmin) {
      const isLocked = await this.redis.isAccountLocked(username)
      if (isLocked) {
        const ttl = await this.redis.ttl(`login:locked:${username}`)
        const remainingMinutes = Math.ceil(ttl / 60)
        throw new UnauthorizedException(
          `TÃ i khoáº£n bá»‹ khÃ³a. Vui lÃ²ng thá»­ láº¡i sau ${remainingMinutes} phÃºt.`,
        )
      }
    }

    if (!user) {
      const attempts = await this.recordFailedAttempt(username)
      if (attempts >= this.maxFailedAttempts) {
        await this.redis.lockAccount(username, this.lockDuration)
        throw new UnauthorizedException(
          `TÃ i khoáº£n bá»‹ khÃ³a do nháº­p sai quÃ¡ ${this.maxFailedAttempts} láº§n. Vui lÃ²ng thá»­ láº¡i sau 15 phÃºt.`,
        )
      }
      throw new UnauthorizedException('TÃªn Ä‘Äƒng nháº­p hoáº·c máº­t kháº©u khÃ´ng Ä‘Ãºng.')
    }

    const valid = await this.isPasswordValid(user, password)
    if (!valid) {
      if (!isAdmin) {
        const attempts = await this.recordFailedAttempt(username)

        if (attempts >= this.maxFailedAttempts) {
          await this.redis.lockAccount(username, this.lockDuration)
          await this.users.logLogin(
            user.user_id,
            'login_failed',
            ip,
            userAgent,
            false,
            `account_locked_after_${attempts}_attempts`,
          )
          throw new UnauthorizedException(
            `TÃ i khoáº£n bá»‹ khÃ³a do nháº­p sai quÃ¡ ${this.maxFailedAttempts} láº§n. Vui lÃ²ng thá»­ láº¡i sau 15 phÃºt.`,
          )
        }
      }
      await this.users.logLogin(
        user.user_id,
        'login_failed',
        ip,
        userAgent,
        false,
        'wrong_password',
      )
      throw new UnauthorizedException('TÃªn Ä‘Äƒng nháº­p hoáº·c máº­t kháº©u khÃ´ng Ä‘Ãºng.')
    }

    const access_token = this.signAccessToken(user)
    const refreshToken = generateRefreshToken()
    const refreshHash = hashRefreshToken(refreshToken)

    await this.users.saveSession(
      user.user_id,
      refreshHash,
      this.refreshExpiresAt(),
      ip,
      userAgent,
    )
    await this.redis.resetFailedAttempts(username)
    await this.users.updateLastLogin(user.user_id)
    await this.users.logLogin(user.user_id, 'login_success', ip, userAgent, true)

    return {
      access_token,
      refresh_token: refreshToken,
      user: this.toUserDto(user),
    }
  }

  async refresh(refreshToken: string, ip: string, userAgent: string) {
    const session = await this.users.findActiveSessionByRefreshHash(
      hashRefreshToken(refreshToken),
    )
    if (!session) {
      throw new UnauthorizedException('Refresh token khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n.')
    }

    const user = await this.users.findById(session.user_id)
    if (!user) {
      throw new UnauthorizedException('TÃ i khoáº£n khÃ´ng cÃ²n hoáº¡t Ä‘á»™ng.')
    }

    const newRefreshToken = generateRefreshToken()
    const newHash = hashRefreshToken(newRefreshToken)
    const newExpiresAt = this.refreshExpiresAt()

    await this.users.rotateSession(
      session.session_id,
      newHash,
      newExpiresAt,
      ip,
      userAgent,
    )
    await this.users.logLogin(session.user_id, 'token_refresh', ip, userAgent, true)

    const access_token = this.signAccessToken(user)

    return {
      access_token,
      refresh_token: newRefreshToken,
      user: this.toUserDto(user),
    }
  }

  async logout(
    refreshToken: string | undefined,
    userId: string,
    ip: string,
    userAgent: string,
  ) {
    if (refreshToken) {
      await this.users.revokeSessionByRefreshHash(hashRefreshToken(refreshToken))
    }
    await this.users.logLogin(userId, 'logout', ip, userAgent, true)
    return { message: 'ÄÄƒng xuáº¥t thÃ nh cÃ´ng.' }
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  private isAdmin(user: any): boolean {
    if (!user || !user.roles) return false
    const roles = (Array.isArray(user.roles) ? user.roles : [user.roles])
      .map((role: string) => String(role).trim().toUpperCase())
      .filter(Boolean)
    return roles.some((r: string) => this.adminBypassRoles.includes(r))
  }

  private async recordFailedAttempt(username: string): Promise<number> {
    return await this.redis.incrementFailedAttempts(username, this.lockWindow)
  }
}
