import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { normalizeRoles } from '../../../../src/common/access-scope'
import { AuthService } from '../auth/auth.service'
import { ADMIN_MANAGEMENT_ROLE_SET } from './admin-management-roles'
import { UsersService } from './users.service'
const ACCOUNT_STATUSES = new Set(['active', 'inactive', 'locked'])

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@Req() req: { user: { userId: string } }) {
    return this.users.findById(req.user.userId)
  }

  @Get('me/account')
  @UseGuards(AuthGuard('jwt'))
  getMyAccount(
    @Req() req: { user: { userId: string; sessionId?: string | null } },
  ) {
    return this.users.getSelfAccount(req.user.userId, req.user.sessionId ?? null)
  }

  @Patch('me/account')
  @UseGuards(AuthGuard('jwt'))
  async updateMyAccount(
    @Req() req: { user: { userId: string; sessionId?: string | null } },
    @Body() body: { full_name?: string },
  ) {
    const fullName = body.full_name?.trim()
    if (!fullName) {
      throw new BadRequestException('Họ và tên không được để trống.')
    }

    if (fullName.length > 120) {
      throw new BadRequestException('Họ và tên không được vượt quá 120 ký tự.')
    }

    const updated = await this.users.updateSelfProfile(req.user.userId, fullName)
    if (!updated) {
      throw new BadRequestException('Không cập nhật được hồ sơ tài khoản.')
    }

    return this.users.getSelfAccount(req.user.userId, req.user.sessionId ?? null)
  }

  @Post('me/change-password')
  @UseGuards(AuthGuard('jwt'))
  async changeMyPassword(
    @Req()
    req: {
      ip?: string
      headers?: Record<string, string | string[] | undefined>
      user: { userId: string }
    },
    @Body()
    body: {
      current_password?: string
      new_password?: string
    },
  ) {
    const currentPassword = body.current_password ?? ''
    const nextPassword = body.new_password ?? ''

    if (!currentPassword || !nextPassword) {
      throw new BadRequestException('Cần nhập đủ mật khẩu hiện tại và mật khẩu mới.')
    }

    if (nextPassword.length < 8) {
      throw new BadRequestException('Mật khẩu mới phải có ít nhất 8 ký tự.')
    }

    if (nextPassword === currentPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại.')
    }

    const userAgent = String(req.headers?.['user-agent'] ?? '')
    return this.auth.changePassword(
      req.user.userId,
      currentPassword,
      nextPassword,
      req.ip ?? '',
      userAgent,
    )
  }

  @Post('me/logout-other-sessions')
  @UseGuards(AuthGuard('jwt'))
  async logoutOtherSessions(
    @Req() req: { user: { userId: string; sessionId?: string | null } },
  ) {
    const revokedCount = await this.users.revokeOtherSessionsForUser(
      req.user.userId,
      req.user.sessionId ?? null,
    )

    return {
      message:
        revokedCount > 0
          ? `Đã đăng xuất ${revokedCount} thiết bị khác.`
          : 'Hiện không có thiết bị khác đang đăng nhập.',
      revoked_count: revokedCount,
    }
  }

  @Get('admin/overview')
  @UseGuards(AuthGuard('jwt'))
  async getAdminOverview(
    @Req() req: { user: { userId: string; roles?: string[] } },
  ) {
    this.assertAdmin(req.user.roles)
    return this.users.getAdminOverview()
  }

  @Get('admin/accounts')
  @UseGuards(AuthGuard('jwt'))
  async listManagedAccounts(
    @Req() req: { user: { userId: string; roles?: string[] } },
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
    @Query('limit') limit?: string,
  ) {
    this.assertAdmin(req.user.roles)

    const normalizedStatus = status?.trim().toLowerCase()
    if (normalizedStatus && !ACCOUNT_STATUSES.has(normalizedStatus)) {
      throw new BadRequestException('Trạng thái tài khoản không hợp lệ.')
    }

    const parsedLimit = limit ? Number(limit) : undefined
    if (parsedLimit !== undefined && (!Number.isFinite(parsedLimit) || parsedLimit <= 0)) {
      throw new BadRequestException('Giới hạn bản ghi không hợp lệ.')
    }

    return this.users.listManagedAccounts({
      search,
      status: normalizedStatus as 'active' | 'inactive' | 'locked' | undefined,
      role,
      limit: parsedLimit,
    })
  }

  @Patch('admin/accounts/:userId/status')
  @UseGuards(AuthGuard('jwt'))
  async updateManagedAccountStatus(
    @Req() req: { user: { userId: string; roles?: string[] } },
    @Param('userId') userId: string,
    @Body() body: { status?: string },
  ) {
    this.assertAdmin(req.user.roles)

    const nextStatus = body.status?.trim().toLowerCase()
    if (!nextStatus || !ACCOUNT_STATUSES.has(nextStatus)) {
      throw new BadRequestException('Cần truyền status hợp lệ: active, inactive hoặc locked.')
    }

    try {
      return await this.users.updateManagedAccountStatus(
        userId,
        nextStatus as 'active' | 'inactive' | 'locked',
        req.user.userId,
      )
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Không cập nhật được trạng thái tài khoản.',
      )
    }
  }

  @Post('admin/accounts/:userId/revoke-sessions')
  @UseGuards(AuthGuard('jwt'))
  async revokeManagedAccountSessions(
    @Req() req: { user: { userId: string; roles?: string[] } },
    @Param('userId') userId: string,
  ) {
    this.assertAdmin(req.user.roles)

    try {
      return await this.users.revokeManagedAccountSessions(userId)
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Không thu hồi được phiên đăng nhập.',
      )
    }
  }

  private assertAdmin(roles: string[] | undefined) {
    const normalized = normalizeRoles(roles)
    if (!normalized.some((role) => ADMIN_MANAGEMENT_ROLE_SET.has(role))) {
      throw new ForbiddenException('Bạn không có quyền quản trị tài khoản.')
    }
  }
}
