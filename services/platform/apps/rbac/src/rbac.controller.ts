import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { isAdminLike } from '../../../src/common/access-scope'
import type { AuthUser } from '../../../src/common/auth.types'
import { RbacService } from './rbac.service'

@Controller('rbac')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'rbac' }
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@Req() req: { user: AuthUser }) {
    return this.rbac.getCurrentAccess(req.user)
  }

  @Get('matrix')
  @UseGuards(AuthGuard('jwt'))
  async getMatrix(@Req() req: { user: AuthUser }) {
    if (!isAdminLike(req.user.roles)) {
      throw new ForbiddenException('Chỉ quản trị viên mới xem được permission matrix.')
    }
    return this.rbac.getRoleMatrix()
  }

  @Post('check')
  @UseGuards(AuthGuard('jwt'))
  check(
    @Req() req: { user: AuthUser },
    @Body() body: { permissionCode?: string; resource?: string; action?: string },
  ) {
    return this.rbac.checkPermission(req.user, body)
  }

  @Post('row-filter')
  @UseGuards(AuthGuard('jwt'))
  rowFilter(
    @Req() req: { user: AuthUser },
    @Body() body: { resource: string; action?: string; categoryCode?: string },
  ) {
    return this.rbac.getRowFilter(req.user, body)
  }
}
