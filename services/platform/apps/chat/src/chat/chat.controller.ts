import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { Response } from 'express'
import { resolveAccessScope } from '../../../../src/common/access-scope'
import { ChatService } from './chat.service'

type AuthUser = {
  userId: string
  username: string
  roles: string[]
  department: string | null
  maxSecurityLevel: number
}

async function toRagUser(u: AuthUser) {
  const scope = await resolveAccessScope(u)
  return {
    userId: scope.userId,
    username: scope.username,
    roles: scope.roles,
    department: scope.department,
    maxSecurityLevel: scope.maxSecurityLevel,
    scopeMaHv: scope.scopeMaHv,
    scopeMaGv: scope.scopeMaGv,
  }
}

@Controller('chat')
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('sessions')
  listSessions(@Req() req: { user: AuthUser }) {
    return this.chat.listSessions(req.user.userId)
  }

  @Post('sessions')
  createSession(
    @Req() req: { user: AuthUser },
    @Body() body: { title?: string },
  ) {
    return this.chat.createSession(req.user.userId, body.title)
  }

  @Get('sessions/:sessionId')
  getSession(
    @Req() req: { user: AuthUser },
    @Param('sessionId') sessionId: string,
  ) {
    return this.chat.getSession(req.user.userId, sessionId)
  }

  @Delete('sessions/:sessionId')
  deleteSession(
    @Req() req: { user: AuthUser },
    @Param('sessionId') sessionId: string,
  ) {
    return this.chat.deleteSession(req.user.userId, sessionId)
  }

  @Get('sessions/:sessionId/messages')
  listMessages(
    @Req() req: { user: AuthUser },
    @Param('sessionId') sessionId: string,
  ) {
    return this.chat.listMessages(req.user.userId, sessionId)
  }

  @Post('sessions/:sessionId/messages')
  async sendMessage(
    @Req() req: { user: AuthUser },
    @Param('sessionId') sessionId: string,
    @Body() body: { content: string },
  ) {
    const ragUser = await toRagUser(req.user)
    return this.chat.sendMessage(
      req.user.userId,
      sessionId,
      body.content,
      ragUser,
    )
  }

  @Post('sessions/:sessionId/messages/stream')
  async streamMessage(
    @Req() req: { user: AuthUser },
    @Res() res: Response,
    @Param('sessionId') sessionId: string,
    @Body() body: { content: string },
  ) {
    const ragUser = await toRagUser(req.user)
    return this.chat.streamMessage(
      req.user.userId,
      sessionId,
      body.content,
      ragUser,
      res,
    )
  }

  // ── Admin-only endpoints ──────────────────────────────────────
  @Get('admin/sessions')
  adminListSessions(
    @Req() req: { user: AuthUser },
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!req.user.roles?.includes('ADMIN')) throw new ForbiddenException()
    return this.chat.adminListSessions(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? Math.min(parseInt(limit, 10), 50) : 20,
    )
  }

  @Get('admin/sessions/:sessionId/messages')
  adminListMessages(
    @Req() req: { user: AuthUser },
    @Param('sessionId') sessionId: string,
  ) {
    if (!req.user.roles?.includes('ADMIN')) throw new ForbiddenException()
    return this.chat.adminListMessages(sessionId)
  }
}
