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
import type { Request, Response } from 'express'
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

// ============================================================
// Helper: extract user from request
// ============================================================

function extractUserFromRequest(req: Request): AuthUser {
  const headers = req.headers

  // 1. Try to read from gateway headers (always present if gateway forwards them)
  const userId = (headers['x-gateway-user-id'] as string) || null
  const username = (headers['x-gateway-username'] as string) || null
  const rolesHeader = headers['x-gateway-roles'] as string
  const department = (headers['x-gateway-department'] as string) || null
  const maxSecurityLevelHeader = headers['x-gateway-max-security-level'] as string

  // If we have gateway headers, use them (they are authoritative)
  if (userId) {
    const roles = rolesHeader?.split(',').filter(Boolean) || ['Anonymous']
    const maxSecurityLevel = parseInt(maxSecurityLevelHeader || '1', 10)
    return {
      userId,
      username: username || 'anonymous',
      roles,
      department,
      maxSecurityLevel,
    }
  }

  // 2. Fallback to JWT user (if any) – only if headers are missing
  if ((req as any).user) {
    const user = (req as any).user as AuthUser
    return {
      userId: user.userId || 'anonymous',
      username: user.username || 'anonymous',
      roles: user.roles || ['Anonymous'],
      department: user.department ?? null,
      maxSecurityLevel: user.maxSecurityLevel ?? 1,
    }
  }

  // 3. Fully anonymous (no headers, no user)
  return {
    userId: 'anonymous',
    username: 'anonymous',
    roles: ['Anonymous'],
    department: null,
    maxSecurityLevel: 1,
  }
}

// ============================================================
// Controller – no class‑level guard
// ============================================================

@Controller('documents')
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  // Public GET – no JWT required
  @Get()
  list(@Req() req: Request) {
    const user = extractUserFromRequest(req)
    return this.docs.list(toRequestUser(user))
  }

  // Protected POST – requires JWT
  @Post()
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file', documentMulterOptions))
  upload(
    @Req() req: Request,
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
    const user = extractUserFromRequest(req)
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
      { userId: user.userId, name: user.username },
    )
  }

  @Get(':id/ingest-status')
  ingestStatus(@Req() req: Request, @Param('id') id: string) {
    const user = extractUserFromRequest(req)
    return this.docs.getIngestStatus(id, toRequestUser(user))
  }

  @Get(':id/chunks')
  @UseGuards(AuthGuard('jwt'))
  async getChunks(@Req() req: Request, @Param('id') id: string) {
    const user = extractUserFromRequest(req)
    const limit = parseInt(req.query.limit as string, 10) || 5
    return this.docs.getChunks(id, toRequestUser(user), Math.min(limit, 20))
  }

  @Get(':id/file')
  @UseGuards(AuthGuard('jwt'))
  async download(
    @Req() req: Request,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const user = extractUserFromRequest(req)
    const doc = await this.docs.getForDownload(id, toRequestUser(user))
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(doc.originalName)}"`,
    )
    createReadStream(doc.storagePath).pipe(res)
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Req() req: Request, @Param('id') id: string) {
    const user = extractUserFromRequest(req)
    return this.docs.remove(id, toRequestUser(user))
  }

  @Get('vung-du-lieu')
  @UseGuards(AuthGuard('jwt'))
  async getVungDuLieu(@Req() req: Request) {
    const user = extractUserFromRequest(req)
    return this.docs.getVungDuLieu(toRequestUser(user))
  }

  @Get('security-level-stats')
  @UseGuards(AuthGuard('jwt'))
  async getSecurityLevelStats(@Req() req: Request) {
    const user = extractUserFromRequest(req)
    return this.docs.getSecurityLevelStats(toRequestUser(user))
  }

  @Get('preview/:role')
  @UseGuards(AuthGuard('jwt'))
  async previewRoleAccess(
    @Req() req: Request,
    @Param('role') role: string,
  ) {
    const user = extractUserFromRequest(req)
    const requestUser = toRequestUser(user)
    // Only admins can preview other roles
    if (!requestUser.roles?.some((r) => ['ADMIN', 'Admin', 'BGD'].includes(r))) {
      throw new ForbiddenException('Chỉ quản trị viên mới có thể xem trước vai trò khác.')
    }
    return this.docs.previewRoleAccess(role)
  }
}
