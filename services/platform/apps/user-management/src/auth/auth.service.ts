import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService, JwtSignOptions } from '@nestjs/jwt'
import { UsersService } from '../user/users.service'
import { RedisService } from '../../../../src/common/redis/redis.service';
import { generateRefreshToken, hashRefreshToken } from './auth.tokens'
import { randomBytes, pbkdf2Sync } from 'node:crypto';

function verifyPassword(password: string, hash: string, salt: string,
                        iterations: number, digest: string): boolean {
    const computed = pbkdf2Sync(password, salt, iterations, hash.length / 2, digest).toString('hex');
    return computed === hash;
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
      return this.config.get<number>('LOGIN_MAX_ATTEMPTS', 5);
  }

  private get lockDuration(): number {
      return this.config.get<number>('LOGIN_LOCK_DURATION', 900);
  }

  private get lockWindow(): number {
      return this.config.get<number>('LOGIN_LOCK_WINDOW', 900);
  }

  private get adminBypassRoles(): string[] {
      const raw = this.config.get<string>('LOGIN_ADMIN_BYPASS_ROLES', 'ADMIN,BGD,P2');
      return raw.split(',').map((r) => r.trim()).filter(Boolean);
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

  async login(username: string, password: string, ip: string, userAgent: string) {
    const user = await this.users.findByUsername(username)
    const isAdmin = user && this.isAdmin(user);

    if (!isAdmin) {
      const isLocked = await this.redis.isAccountLocked(username);
      if (isLocked) {
          const ttl = await this.redis.ttl(`login:locked:${username}`);
          const remainingMinutes = Math.ceil(ttl / 60);
          throw new UnauthorizedException(
              `Tài khoản bị khóa. Vui lòng thử lại sau ${remainingMinutes} phút.`
          );
      }
    }

    if (!user) {
      const attempts = await this.recordFailedAttempt(username);
      if (attempts >= this.maxFailedAttempts) {
          await this.redis.lockAccount(username, this.lockDuration);
          throw new UnauthorizedException(
              `Tài khoản bị khóa do nhập sai quá ${this.maxFailedAttempts} lần. Vui lòng thử lại sau 15 phút.`
          );
      }
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng.')
    }

    if (!user.hash_algorithm.startsWith('pbkdf2')) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng.');
    }

    const valid = await verifyPassword(password, user.password_hash, user.password_salt,
                                       user.hash_iterations, user.hash_algorithm.split('_')[1])
    if (!valid) {
      if (!isAdmin) {
        const attempts = await this.recordFailedAttempt(username);
        
        if (attempts >= this.maxFailedAttempts) {
            await this.redis.lockAccount(username, this.lockDuration);
            await this.users.logLogin(
                user.user_id,
                'login_failed',
                ip,
                userAgent,
                false,
                `account_locked_after_${attempts}_attempts`
            );
            throw new UnauthorizedException(
                `Tài khoản bị khóa do nhập sai quá ${this.maxFailedAttempts} lần. Vui lòng thử lại sau 15 phút.`
            );
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
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng.')
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
    await this.redis.resetFailedAttempts(username);
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
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn.')
    }

    const user = await this.users.findById(session.user_id)
    if (!user) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động.')
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
    return { message: 'Đăng xuất thành công.' }
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  private isAdmin(user: any): boolean {
      if (!user || !user.roles) return false;
      const roles = Array.isArray(user.roles) ? user.roles : [user.roles];
      return roles.some((r: string) => this.adminBypassRoles.includes(r));
  }

  private async recordFailedAttempt(username: string): Promise<number> {
      return await this.redis.incrementFailedAttempts(username, this.lockWindow);
  }
}
