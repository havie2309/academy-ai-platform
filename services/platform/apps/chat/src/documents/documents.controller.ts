import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { AuthGuard } from '@nestjs/passport'
import type { Response } from 'express'
import { createReadStream } from 'node:fs'
import {
  DocumentsService,
  type AccessScopeType,
  type RequestUser,
  type SecurityLevel,
  type UploadedFileLike,
} from './documents.service'
import { documentMulterOptions } from './documents.storage'

type AuthUser = {
  userId: string
  username: string
  roles: string[]
  department: string | null
  maxSecurityLevel: number
}

const SECURITY_LEVELS: SecurityLevel[] = [
  'public',
  'internal',
  'restricted',
  'confidential',
]
const SCOPE_TYPES: AccessScopeType[] = ['all', 'role', 'department', 'custom']

/** Form gửi mảng dưới dạng chuỗi phân tách bằng dấu phẩy hoặc JSON. */
function parseList(raw?: string): string[] {
  if (!raw) return []
  const trimmed = raw.trim()
  if (!trimmed) return []
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
  } catch {
    // not JSON, fall back to comma-separated
  }
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function toRequestUser(u: AuthUser): RequestUser {
  return {
    userId: u.userId,
    roles: u.roles ?? [],
    department: u.department ?? null,
    maxSecurityLevel: u.maxSecurityLevel ?? 1,
  }
}

@Controller('documents')
@UseGuards(AuthGuard('jwt'))
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Get()
  list(@Req() req: { user: AuthUser }) {
    return this.docs.list(toRequestUser(req.user))
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', documentMulterOptions))
  upload(
    @Req() req: { user: AuthUser },
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body()
    body: {
      title?: string
      category?: string
      security_level?: string
      scope_type?: string
      access_role_codes?: string
      access_department_codes?: string
      access_user_ids?: string
    },
  ) {
    if (!file) throw new BadRequestException('Chưa chọn file để tải lên.')

    const securityLevel = (body.security_level ?? 'internal') as SecurityLevel
    if (!SECURITY_LEVELS.includes(securityLevel)) {
      throw new BadRequestException(`Mức mật không hợp lệ: ${body.security_level}`)
    }
    const scopeType = (body.scope_type ?? 'all') as AccessScopeType
    if (!SCOPE_TYPES.includes(scopeType)) {
      throw new BadRequestException(`Phạm vi truy cập không hợp lệ: ${body.scope_type}`)
    }

    return this.docs.create(
      file,
      {
        title: body.title,
        category: body.category,
        access: {
          securityLevel,
          scopeType,
          roleCodes: parseList(body.access_role_codes),
          departmentCodes: parseList(body.access_department_codes),
          userIds: parseList(body.access_user_ids),
        },
      },
      { userId: req.user.userId, name: req.user.username },
    )
  }

  @Get(':id/ingest-status')
  ingestStatus(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.docs.getIngestStatus(id, toRequestUser(req.user))
  }

  @Get(':id/file')
  async download(
    @Req() req: { user: AuthUser },
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const doc = await this.docs.getForDownload(id, toRequestUser(req.user))
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(doc.originalName)}"`,
    )
    createReadStream(doc.storagePath).pipe(res)
  }

  @Delete(':id')
  remove(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.docs.remove(id, toRequestUser(req.user))
  }

  @Get('vung-du-lieu')
  async getVungDuLieu(@Req() req: { user: AuthUser }) {
    return this.docs.getVungDuLieu(toRequestUser(req.user));
  }

  @Get('security-level-stats')
  async getSecurityLevelStats(@Req() req: { user: AuthUser }) {
    return this.docs.getSecurityLevelStats(toRequestUser(req.user));
  }

  @Get('preview/:role')
  @UseGuards(AuthGuard('jwt'))
  async previewRoleAccess(
    @Req() req: { user: AuthUser },
    @Param('role') role: string
  ) {
    // Only admins can preview other roles
    const user = toRequestUser(req.user);
    if (!user.roles?.some(r => ['ADMIN', 'Admin', 'BGD'].includes(r))) {
      throw new ForbiddenException('Chỉ quản trị viên mới có thể xem trước vai trò khác.');
    }
    return this.docs.previewRoleAccess(role);
  }
}
