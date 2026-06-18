import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { AuthService } from './auth.service'
import {
  clearRefreshCookie,
  readCookie,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
} from './auth.cookies'
import type { Request, Response } from 'express'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(
    @Body() body: { username: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip ?? ''
    const ua = req.headers['user-agent'] ?? ''
    const result = await this.auth.login(body.username, body.password, ip, ua)
    setRefreshCookie(res, result.refresh_token)
    return { access_token: result.access_token, user: result.user }
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = readCookie(req, REFRESH_COOKIE_NAME)
    if (!refreshToken) {
      clearRefreshCookie(res)
      throw new UnauthorizedException('Không có refresh token.')
    }
    const ip = req.ip ?? ''
    const ua = req.headers['user-agent'] ?? ''
    try {
      const result = await this.auth.refresh(refreshToken, ip, ua)
      setRefreshCookie(res, result.refresh_token)
      return { access_token: result.access_token, user: result.user }
    } catch {
      clearRefreshCookie(res)
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn.')
    }
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  logout(
    @Req() req: Request & { user: { userId: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = readCookie(req, REFRESH_COOKIE_NAME)
    const ip = req.ip ?? ''
    const ua = req.headers['user-agent'] ?? ''
    clearRefreshCookie(res)
    return this.auth.logout(refreshToken, req.user.userId, ip, ua)
  }

}
