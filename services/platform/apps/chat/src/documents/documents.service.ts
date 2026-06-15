import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { existsSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { Collection, Db, MongoClient } from 'mongodb'

export interface UploadedFileLike {
  originalname: string
  filename: string
  path: string
  mimetype: string
  size: number
}

export type SecurityLevel =
  | 'public'
  | 'internal'
  | 'restricted'
  | 'confidential'

export type AccessScopeType = 'all' | 'role' | 'department' | 'custom'

export interface RequestUser {
  userId: string
  roles: string[]
  department: string | null
  maxSecurityLevel: number
}

export interface AccessMeta {
  securityLevel: SecurityLevel
  scopeType: AccessScopeType
  roleCodes: string[]
  departmentCodes: string[]
  userIds: string[]
}

interface DocumentDoc {
  docId: string
  title: string
  category: string
  originalName: string
  storedName: string
  storagePath: string
  mimeType: string
  size: number
  securityLevel: SecurityLevel
  scopeType: AccessScopeType
  accessRoleCodes: string[]
  accessDepartmentCodes: string[]
  accessUserIds: string[]
  uploadedById: string
  uploadedByName: string
  createdAt: Date
}

const DEFAULT_CATEGORY = 'Khác'

const SECURITY_RANK: Record<SecurityLevel, number> = {
  public: 1,
  internal: 2,
  restricted: 3,
  confidential: 4,
}

const ADMIN_ROLES = ['ADMIN', 'Admin', 'BGD', 'P2']

function securityRank(level: SecurityLevel): number {
  return SECURITY_RANK[level] ?? SECURITY_RANK.internal
}

@Injectable()
export class DocumentsService implements OnModuleInit {
  private client!: MongoClient
  private db!: Db
  private documents!: Collection<DocumentDoc>

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const uri =
      this.config.get<string>('MONGO_URI') ??
      `mongodb://${this.config.get('MONGO_USER', 'pm2_user')}:${this.config.get('MONGO_PASSWORD', 'pm2pass')}@${this.config.get('MONGO_HOST', 'localhost')}:${this.config.get('MONGO_PORT', '27017')}/${this.config.get('MONGO_DB', 'pm2')}?authSource=admin`

    this.client = new MongoClient(uri)
    await this.client.connect()
    this.db = this.client.db(this.config.get('MONGO_DB', 'pm2'))
    this.documents = this.db.collection<DocumentDoc>('documents')
    await this.documents.createIndex({ createdAt: -1 })
  }

  private ensureReady() {
    if (!this.documents) {
      throw new ServiceUnavailableException('Document database chưa sẵn sàng.')
    }
  }

  async create(
    file: UploadedFileLike,
    meta: { title?: string; category?: string; access: AccessMeta },
    user: { userId: string; name: string },
  ) {
    this.ensureReady()
    const access = meta.access
    const doc: DocumentDoc = {
      docId: file.filename.replace(/\.[^.]+$/, ''),
      title: meta.title?.trim() || file.originalname,
      category: meta.category?.trim() || DEFAULT_CATEGORY,
      originalName: file.originalname,
      storedName: file.filename,
      storagePath: file.path,
      mimeType: file.mimetype,
      size: file.size,
      securityLevel: access.securityLevel,
      scopeType: access.scopeType,
      accessRoleCodes: access.scopeType === 'role' ? access.roleCodes : [],
      accessDepartmentCodes:
        access.scopeType === 'department' ? access.departmentCodes : [],
      accessUserIds: access.scopeType === 'custom' ? access.userIds : [],
      uploadedById: user.userId,
      uploadedByName: user.name,
      createdAt: new Date(),
    }
    await this.documents.insertOne(doc)
    return this.toDto(doc)
  }

  private isPrivileged(user: RequestUser): boolean {
    return user.roles?.some((r) => ADMIN_ROLES.includes(r)) ?? false
  }

  /** Người dùng có được xem tài liệu này không (mức mật + phạm vi). */
  private canView(doc: DocumentDoc, user: RequestUser): boolean {
    if (doc.uploadedById === user.userId) return true
    if (this.isPrivileged(user)) return true

    // Tài liệu cũ (trước khi có phân quyền): mặc định internal + phạm vi tất cả.
    const level = doc.securityLevel ?? 'internal'
    const scope = doc.scopeType ?? 'all'

    if (securityRank(level) > (user.maxSecurityLevel ?? 1)) {
      return false
    }

    switch (scope) {
      case 'all':
        return true
      case 'role':
        return (user.roles ?? []).some((r) =>
          (doc.accessRoleCodes ?? []).includes(r),
        )
      case 'department':
        return (
          !!user.department &&
          (doc.accessDepartmentCodes ?? []).includes(user.department)
        )
      case 'custom':
        return (doc.accessUserIds ?? []).includes(user.userId)
      default:
        return false
    }
  }

  async list(user: RequestUser) {
    this.ensureReady()
    const rows = await this.documents
      .find({})
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray()
    return rows.filter((d) => this.canView(d, user)).map((d) => this.toDto(d))
  }

  async getForDownload(
    docId: string,
    user: RequestUser,
  ): Promise<DocumentDoc> {
    this.ensureReady()
    const doc = await this.documents.findOne({ docId })
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.')
    if (!this.canView(doc, user)) {
      throw new ForbiddenException('Bạn không có quyền xem tài liệu này.')
    }
    if (!existsSync(doc.storagePath)) {
      throw new NotFoundException('File đã bị xóa khỏi hệ thống lưu trữ.')
    }
    return doc
  }

  async remove(docId: string, user: RequestUser): Promise<{ deleted: true }> {
    this.ensureReady()
    const doc = await this.documents.findOne({ docId })
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.')

    const isOwner = doc.uploadedById === user.userId
    if (!isOwner && !this.isPrivileged(user)) {
      throw new ForbiddenException('Bạn không có quyền xóa tài liệu này.')
    }

    await this.documents.deleteOne({ docId })
    if (existsSync(doc.storagePath)) {
      await unlink(doc.storagePath).catch(() => {})
    }
    return { deleted: true }
  }

  private toDto(d: DocumentDoc) {
    return {
      id: d.docId,
      title: d.title,
      category: d.category,
      original_name: d.originalName,
      mime_type: d.mimeType,
      size: d.size,
      security_level: d.securityLevel,
      scope_type: d.scopeType,
      access_role_codes: d.accessRoleCodes,
      access_department_codes: d.accessDepartmentCodes,
      access_user_ids: d.accessUserIds,
      uploaded_by: d.uploadedByName,
      uploaded_by_id: d.uploadedById,
      created_at: d.createdAt.toISOString(),
    }
  }
}
