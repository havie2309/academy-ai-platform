import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { Response } from 'express'
import { ChatService } from './chat.service'

type AuthUser = { userId: string; username: string; roles: string[] }

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
  sendMessage(
    @Req() req: { user: AuthUser },
    @Param('sessionId') sessionId: string,
    @Body() body: { content: string },
  ) {
    return this.chat.sendMessage(req.user.userId, sessionId, body.content)
  }

  @Post('sessions/:sessionId/messages/stream')
  streamMessage(
    @Req() req: { user: AuthUser },
    @Res() res: Response,
    @Param('sessionId') sessionId: string,
    @Body() body: { content: string },
  ) {
    return this.chat.streamMessage(
      req.user.userId,
      sessionId,
      body.content,
      res,
    )
  }
}
