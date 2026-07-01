import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
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

  @Get('security-alerts')
  @UseGuards(AuthGuard('jwt'))
  listSecurityAlerts(
    @Req() req: { user: AuthUser },
    @Query()
    query: {
      severity?: string
      status?: string
      ruleCode?: string
      userId?: string
      resourceType?: string
      from?: string
      to?: string
      limit?: string
    },
  ) {
    return this.audit.listSecurityAlerts(req.user, query)
  }

  @Get('service-logs')
  @UseGuards(AuthGuard('jwt'))
  listServiceLogs(
    @Req() req: { user: AuthUser },
    @Query()
    query: {
      service?: string
      level?: string
      from?: string
      to?: string
      search?: string
      limit?: string
    },
  ) {
    return this.audit.listServiceLogs(req.user, query)
  }

  @Get('security-alerts/:id')
  @UseGuards(AuthGuard('jwt'))
  getSecurityAlert(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.audit.getSecurityAlert(req.user, id)
  }

  @Patch('security-alerts/:id/status')
  @UseGuards(AuthGuard('jwt'))
  updateSecurityAlertStatus(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Body() body: { status?: string },
  ) {
    return this.audit.updateSecurityAlertStatus(req.user, id, body.status ?? '')
  }
}
