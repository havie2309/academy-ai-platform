import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { AuthGuard } from '@nestjs/passport'
import { DocumentsService, type UploadedFileLike } from '../documents/documents.service'
import { documentMulterOptions } from '../documents/documents.storage'
import { PersonalFoldersService } from './personal-folders.service'

type AuthUser = {
  userId: string
  username: string
  roles: string[]
  department: string | null
  maxSecurityLevel: number
}

@Controller('personal-folders')
@UseGuards(AuthGuard('jwt'))
export class PersonalFoldersController {
  constructor(
    private readonly folders: PersonalFoldersService,
    private readonly documents: DocumentsService,
  ) {}

  @Get()
  list(@Req() req: { user: AuthUser }) {
    return this.folders.list(req.user.userId)
  }

  @Post()
  create(
    @Req() req: { user: AuthUser },
    @Body() body: { name?: string; description?: string },
  ) {
    return this.folders.create(req.user.userId, body.name, body.description)
  }

  @Get(':folderId')
  get(@Req() req: { user: AuthUser }, @Param('folderId') folderId: string) {
    return this.folders.get(folderId, req.user.userId)
  }

  @Patch(':folderId')
  update(
    @Req() req: { user: AuthUser },
    @Param('folderId') folderId: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.folders.update(folderId, req.user.userId, body.name, body.description)
  }

  @Delete(':folderId')
  remove(@Req() req: { user: AuthUser }, @Param('folderId') folderId: string) {
    return this.folders.remove(folderId, req.user.userId)
  }

  @Get(':folderId/documents')
  async listDocuments(
    @Req() req: { user: AuthUser },
    @Param('folderId') folderId: string,
  ) {
    await this.folders.getOwned(folderId, req.user.userId)
    return this.documents.listByPersonalFolder(folderId, req.user.userId)
  }

  @Post(':folderId/documents')
  @UseInterceptors(FileInterceptor('file', documentMulterOptions))
  async uploadDocument(
    @Req() req: { user: AuthUser },
    @Param('folderId') folderId: string,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body() body: { title?: string; category?: string },
  ) {
    await this.folders.getOwned(folderId, req.user.userId)
    if (!file) throw new BadRequestException('Chưa chọn file để tải lên.')
    const securityLevel = (req.user.maxSecurityLevel ?? 1) >= 2 ? 'internal' : 'public'
    return this.documents.create(
      file,
      {
        title: body.title,
        category: body.category || 'Tài liệu cá nhân',
        access: {
          securityLevel,
          scopeType: 'custom',
          roleCodes: [],
          departmentCodes: [],
          userIds: [req.user.userId],
        },
        security: {
          documentType: 'personal_document',
          domain: 'personal',
          publicationStatus: 'internal',
          aiAccessPolicy: 'allow',
        },
        personalFolderId: folderId,
      },
      { userId: req.user.userId, name: req.user.username },
    )
  }
}
