import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Put,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { AuthUser } from '../../../src/common/auth.types'
import { AdminConfigService } from './admin-config.service'

const INTERNAL_KEY_HEADER = 'x-admin-config-key'

@Controller('admin-config')
export class AdminConfigController {
  constructor(private readonly adminConfig: AdminConfigService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'admin-config' }
  }

  @Get('rag-policy')
  @UseGuards(AuthGuard('jwt'))
  getRagPolicy(@Req() req: { user: AuthUser }) {
    if (!this.adminConfig.canManagePolicy(req.user)) {
      throw new ForbiddenException(
        'Tai khoan hien tai khong co quyen xem cau hinh AI.',
      )
    }
    return this.adminConfig.getRagPolicy()
  }

  @Put('rag-policy')
  @UseGuards(AuthGuard('jwt'))
  updateRagPolicy(
    @Req()
    req: {
      user: AuthUser
      ip?: string
      headers: Record<string, string | string[] | undefined>
    },
    @Body()
    body: {
      enabled?: boolean
      blacklistKeywords?: string[]
      safeRefusalMessage?: string
      reason?: string
    },
  ) {
    const forwardedFor = req.headers['x-forwarded-for']
    const ipAddress = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor ?? req.ip
    return this.adminConfig.updateRagPolicy(
      req.user,
      body,
      ipAddress,
      String(req.headers['user-agent'] ?? ''),
    )
  }

  @Get('internal/rag-policy')
  async getInternalPolicy(
    @Headers(INTERNAL_KEY_HEADER) internalKey: string | undefined,
  ) {
    const expected = process.env.ADMIN_CONFIG_INTERNAL_KEY?.trim()
    if (!expected) {
      throw new ServiceUnavailableException(
        'ADMIN_CONFIG_INTERNAL_KEY is not configured.',
      )
    }
    if (internalKey?.trim() !== expected) {
      throw new UnauthorizedException('invalid admin-config internal key')
    }
    return this.adminConfig.getRagPolicy()
  }
}
