import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { UsersService } from '../user/users.service'
import * as bcrypt from 'bcrypt'

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string, ip: string, userAgent: string) {
    const user = await this.users.findByUsername(username)

    if (!user) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng.')
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      await this.users.logLogin(user.user_id, 'login_failed', ip, userAgent, false, 'wrong_password')
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng.')
    }

    const payload = {
      sub:      user.user_id,
      username: user.username,
      roles:    user.roles ?? [],
    }

    const access_token = this.jwt.sign(payload)

    // Tính expiry để lưu session
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 8)

    await this.users.saveSession(user.user_id, access_token, expiresAt, ip, userAgent)
    await this.users.updateLastLogin(user.user_id)
    await this.users.logLogin(user.user_id, 'login_success', ip, userAgent, true)

    return {
      access_token,
      user: {
        id:        user.user_id,
        username:  user.username,
        full_name: user.fullname,
        roles:     user.roles ?? [],
        unit_id:   user.department ?? null,
      },
    }
  }

  async logout(token: string, userId: string, ip: string, userAgent: string) {
    await this.users.revokeSession(token)
    await this.users.logLogin(userId, 'logout', ip, userAgent, true)
    return { message: 'Đăng xuất thành công.' }
  }
}