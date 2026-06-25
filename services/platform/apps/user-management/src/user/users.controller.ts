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
import { ADMIN_MANAGEMENT_ROLE_SET } from './admin-management-roles'
import { UsersService } from './users.service'
const ACCOUNT_STATUSES = new Set(['active', 'inactive', 'locked'])

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@Req() req: { user: { userId: string } }) {
    return this.users.findById(req.user.userId)
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
