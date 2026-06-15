import { Controller, Post, Body, Req, UseGuards, Headers } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { AuthService } from './auth.service'
import type { Request } from 'express'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(
    @Body() body: { username: string; password: string },
    @Req() req: Request,
  ) {
    const ip = req.ip ?? ''
    const ua = req.headers['user-agent'] ?? ''
    return this.auth.login(body.username, body.password, ip, ua)
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  logout(
    @Req() req: Request & { user: { userId: string } },
    @Headers('authorization') authHeader: string,
  ) {
    const token = authHeader?.replace('Bearer ', '') ?? ''
    const ip = req.ip ?? ''
    const ua = req.headers['user-agent'] ?? ''
    return this.auth.logout(token, req.user.userId, ip, ua)
  }
}