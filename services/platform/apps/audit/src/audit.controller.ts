import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { AuthUser } from '../../../src/common/auth.types'
import { AuditService } from './audit.service'

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'audit' }
  }

  @Get('logs')
  @UseGuards(AuthGuard('jwt'))
  listLogs(
    @Req() req: { user: AuthUser },
    @Query()
    query: {
      status?: string
      action?: string
      resourceType?: string
      userId?: string
      resourceId?: string
      from?: string
      to?: string
      limit?: string
    },
  ) {
    return this.audit.listLogs(req.user, query)
  }

  @Get('logs/:id')
  @UseGuards(AuthGuard('jwt'))
  getLog(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.audit.getLog(req.user, id)
  }
}
