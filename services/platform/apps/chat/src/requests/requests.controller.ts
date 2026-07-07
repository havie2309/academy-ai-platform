import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FilesInterceptor } from '@nestjs/platform-express'
import type { Request } from 'express'
import { documentMulterOptions } from '../documents/documents.storage'
import { RequestsService } from './requests.service'

function extractUser(req: Request) {
  const h = req.headers
  const userId = (h['x-gateway-user-id'] as string) || (req as any).user?.userId || 'anonymous'
  const username = (h['x-gateway-username'] as string) || (req as any).user?.username || 'anonymous'
  const rolesRaw = h['x-gateway-roles'] as string
  const roles = rolesRaw?.split(',').filter(Boolean) ?? (req as any).user?.roles ?? ['Anonymous']
  return { userId, username, roles }
}

@Controller('documents/requests')
@UseGuards(AuthGuard('jwt'))
export class RequestsController {
  constructor(private readonly svc: RequestsService) {}

  /** POST /api/documents/requests — tạo yêu cầu mới, upload nhiều file cùng lúc */
  @Post()
  @UseInterceptors(FilesInterceptor('files', 20, documentMulterOptions))
  create(
    @Req() req: Request,
    @UploadedFiles() files: { originalname: string; path: string; mimetype: string; size: number }[],
    @Body()
    body: {
      type: string
      zone: string
      desc?: string
      files_meta?: string   // JSON string: [{code,name,author,...}]
    },
  ) {
    const user = extractUser(req)
    return this.svc.create(files ?? [], body, { userId: user.userId, username: user.username })
  }

  /** GET /api/documents/requests — danh sách yêu cầu */
  @Get()
  list(
    @Req() req: Request,
    @Query('zone') zone?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const user = extractUser(req)
    return this.svc.list({ zone, status, search }, { userId: user.userId, roles: user.roles })
  }

  /** GET /api/documents/requests/:id — chi tiết 1 yêu cầu */
  @Get(':id')
  getOne(@Req() req: Request, @Param('id') id: string) {
    const user = extractUser(req)
    return this.svc.getOne(id, { userId: user.userId, roles: user.roles })
  }

  /** POST /api/documents/requests/:id/approve — admin duyệt → trigger ingest */
  @Post(':id/approve')
  approve(@Req() req: Request, @Param('id') id: string) {
    const user = extractUser(req)
    return this.svc.approve(id, { userId: user.userId, username: user.username, roles: user.roles })
  }

  /** POST /api/documents/requests/:id/reject — admin từ chối */
  @Post(':id/reject')
  reject(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const user = extractUser(req)
    return this.svc.reject(id, { userId: user.userId, roles: user.roles }, body.reason)
  }
}
