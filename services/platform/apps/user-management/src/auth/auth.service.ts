import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService, JwtSignOptions } from '@nestjs/jwt'
import { UsersService } from '../user/users.service'
import * as bcrypt from 'bcrypt'
import { generateRefreshToken, hashRefreshToken } from './auth.tokens'

const REFRESH_TTL_DAYS = 7

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

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

    if (!user) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng.')
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
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
}
