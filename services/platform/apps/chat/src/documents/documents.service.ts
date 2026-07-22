import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, unlink } from 'node:fs/promises'
import { Collection, Db, MongoClient } from 'mongodb'
import { IngestQueueService } from '../ingest/ingest-queue.service'
import { writeAuditLog } from '../../../../src/common/audit-log'
import type { Response } from 'express'
import { initSse, writeSseEvent, writeSseError } from '../chat/chat-sse.util'

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

export type PublicationStatus = 'public' | 'internal' | 'confidential' | 'embargoed'
export type AiAccessPolicy = 'allow' | 'deny' | 'restricted' | 'review_required'

export interface DocumentSecurityMeta {
  documentType?: string
  domain?: string
  publicationStatus?: PublicationStatus
  aiAccessPolicy?: AiAccessPolicy
  ownerUnit?: string
  tags?: string[]
  domainMetadata?: Record<string, unknown>
}

export interface AccessMeta {
  securityLevel: SecurityLevel
  scopeType: AccessScopeType
  roleCodes: string[]
  departmentCodes: string[]
  userIds: string[]
  security?: DocumentSecurityMeta
}

type IngestStatus = 'pending' | 'processing' | 'completed' | 'failed'

interface DocumentDoc {
  docId: string
  documentKey?: string
  title: string
  category: string
  originalName: string
  storedName: string
  storagePath: string
  mimeType: string
  size: number
  fileChecksum?: string
  version?: number
  isLatestVersion?: boolean
  previousVersionDocId?: string | null
  securityLevel: SecurityLevel
  scopeType: AccessScopeType
  accessRoleCodes: string[]
  accessDepartmentCodes: string[]
  accessUserIds: string[]
  uploadedById: string
  uploadedByName: string
  createdAt: Date
  updatedAt?: Date
  ingestStatus?: IngestStatus
  ingestStage?: string
  chunkCount?: number
  ingestError?: string | null
  ingestUpdatedAt?: Date
  documentType?: string
  domain?: string
  publicationStatus?: PublicationStatus
  aiAccessPolicy?: AiAccessPolicy
  ownerUnit?: string
  tags?: string[]
  domainMetadata?: Record<string, unknown>
  personalFolderId?: string
}

interface DocumentVersionDoc {
  versionId: string
  docId: string
  documentKey: string
  version: number
  title: string
  category: string
  originalName: string
  storagePath: string
  size: number
  fileChecksum: string
  securityLevel: SecurityLevel
  scopeType: AccessScopeType
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

const ADMIN_ROLES = ['ADMIN', 'Admin', 'BGD', 'P2', 'P7']
const ROLE_CODE_RE = /^[A-Za-z0-9_-]+$/

const CATEGORY_SECURITY_DEFAULTS: Record<
  string,
  { domain: string; documentType: string }
> = {
  'Lịch thi': { domain: 'exam', documentType: 'exam' },
  'Tài liệu môn học': { domain: 'academic', documentType: 'course_material' },
  'Quy chế': { domain: 'regulation', documentType: 'regulation' },
  Khác: { domain: 'general', documentType: 'document' },
}

const PUBLICATION_STATUSES: PublicationStatus[] = [
  'public',
  'internal',
  'confidential',
  'embargoed',
]
const AI_ACCESS_POLICIES: AiAccessPolicy[] = [
  'allow',
  'deny',
  'restricted',
  'review_required',
]

function defaultPublicationStatus(level: SecurityLevel): PublicationStatus {
  if (level === 'public') return 'public'
  if (level === 'confidential') return 'confidential'
  return 'internal'
}

function defaultAiAccessPolicy(level: SecurityLevel): AiAccessPolicy {
  if (level === 'confidential') return 'deny'
  if (level === 'restricted') return 'restricted'
  return 'allow'
}

function securityRank(level: SecurityLevel): number {
  return SECURITY_RANK[level] ?? SECURITY_RANK.internal
}

function normalizeDocumentKey(title: string, category: string): string {
  return `${category}::${title}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

@Injectable()
export class DocumentsService implements OnModuleInit {
  private client!: MongoClient
  private db!: Db
  private documents!: Collection<DocumentDoc>
  private documentVersions!: Collection<DocumentVersionDoc>

  constructor(
    private readonly config: ConfigService,
    private readonly ingestQueue: IngestQueueService,
  ) {}

  async onModuleInit() {
    const mongoHost =
      this.config.get<string>('MONGO_HOST')?.trim() === 'localhost'
        ? '127.0.0.1'
        : (this.config.get<string>('MONGO_HOST')?.trim() ?? '127.0.0.1')

    const uri =
      this.config.get<string>('MONGO_URI') ??
      `mongodb://${this.config.get('MONGO_USER', 'pm2_user')}:${this.config.get('MONGO_PASSWORD', 'pm2pass')}@${mongoHost}:${this.config.get('MONGO_PORT', '27017')}/${this.config.get('MONGO_DB', 'pm2')}?authSource=admin`

    this.client = new MongoClient(uri)
    await this.client.connect()
    this.db = this.client.db(this.config.get('MONGO_DB', 'pm2'))
    this.documents = this.db.collection<DocumentDoc>('documents')
    this.documentVersions =
      this.db.collection<DocumentVersionDoc>('document_versions')
    await this.documents.createIndex({ createdAt: -1 })
    await this.documents.createIndex({ documentKey: 1, version: -1 })
    await this.documents.createIndex({ documentKey: 1, isLatestVersion: 1 })
    await this.documents.createIndex({ fileChecksum: 1 })
    await this.documentVersions.createIndex({ documentKey: 1, version: -1 })
  }

  private ensureReady() {
    if (!this.documents) {
      throw new ServiceUnavailableException('Document database chưa sẵn sàng.')
    }
  }

  private normalizeUnique(values: string[]): string[] {
    const seen = new Set<string>()
    const result: string[] = []
    for (const value of values) {
      const item = value.trim()
      if (!item || seen.has(item)) continue
      seen.add(item)
      result.push(item)
    }
    return result
  }

  private sanitizeAccessMeta(access: AccessMeta): AccessMeta {
    const roleCodes = this.normalizeUnique(access.roleCodes ?? [])
    const departmentCodes = this.normalizeUnique(access.departmentCodes ?? [])
    const userIds = this.normalizeUnique(access.userIds ?? [])

    if (access.scopeType === 'role') {
      if (!roleCodes.length) {
        throw new BadRequestException(
          'scope_type=role yêu cầu ít nhất 1 access_role_code.',
        )
      }
      if (!roleCodes.every((code) => ROLE_CODE_RE.test(code))) {
        throw new BadRequestException('access_role_codes không hợp lệ.')
      }
    }

    if (access.scopeType === 'department' && !departmentCodes.length) {
      throw new BadRequestException(
        'scope_type=department yêu cầu ít nhất 1 access_department_code.',
      )
    }

    if (access.scopeType === 'custom' && !userIds.length) {
      throw new BadRequestException(
        'scope_type=custom yêu cầu ít nhất 1 access_user_id.',
      )
    }

    return {
      securityLevel: access.securityLevel,
      scopeType: access.scopeType,
      roleCodes: access.scopeType === 'role' ? roleCodes : [],
      departmentCodes:
        access.scopeType === 'department' ? departmentCodes : [],
      userIds: access.scopeType === 'custom' ? userIds : [],
    }
  }

  private sanitizeSecurityMeta(
    security: DocumentSecurityMeta | undefined,
    category: string,
    securityLevel: SecurityLevel,
  ): Required<
    Pick<
      DocumentDoc,
      | 'documentType'
      | 'domain'
      | 'publicationStatus'
      | 'aiAccessPolicy'
      | 'ownerUnit'
      | 'tags'
      | 'domainMetadata'
    >
  > {
    const categoryDefaults =
      CATEGORY_SECURITY_DEFAULTS[category] ?? CATEGORY_SECURITY_DEFAULTS.Khác

    const publicationStatus = security?.publicationStatus
    const aiAccessPolicy = security?.aiAccessPolicy

    if (publicationStatus && !PUBLICATION_STATUSES.includes(publicationStatus)) {
      throw new BadRequestException(
        `publication_status không hợp lệ: ${publicationStatus}`,
      )
    }
    if (aiAccessPolicy && !AI_ACCESS_POLICIES.includes(aiAccessPolicy)) {
      throw new BadRequestException(
        `ai_access_policy không hợp lệ: ${aiAccessPolicy}`,
      )
    }

    const domainMetadata =
      security?.domainMetadata && typeof security.domainMetadata === 'object'
        ? security.domainMetadata
        : {}

    return {
      documentType:
        security?.documentType?.trim() || categoryDefaults.documentType,
      domain: security?.domain?.trim().toLowerCase() || categoryDefaults.domain,
      publicationStatus:
        publicationStatus ?? defaultPublicationStatus(securityLevel),
      aiAccessPolicy: aiAccessPolicy ?? defaultAiAccessPolicy(securityLevel),
      ownerUnit: security?.ownerUnit?.trim() ?? '',
      tags: this.normalizeUnique(security?.tags ?? []),
      domainMetadata,
    }
  }

  private async sha256File(filePath: string): Promise<string> {
    const buf = await readFile(filePath)
    return createHash('sha256').update(buf).digest('hex')
  }

  private getInternalSecret(): string | undefined {
    return this.config.get<string>('GATEWAY_INTERNAL_SHARED_SECRET') || undefined;
  }

  async create(
    file: UploadedFileLike,
    meta: {
      title?: string
      category?: string
      access: AccessMeta
      security?: DocumentSecurityMeta
      personalFolderId?: string
    },
    user: { userId: string; name: string },
  ) {
    this.ensureReady()
    const access = this.sanitizeAccessMeta(meta.access)
    const now = new Date()
    const title = meta.title?.trim() || file.originalname
    const category = meta.category?.trim() || DEFAULT_CATEGORY
    const security = this.sanitizeSecurityMeta(
      meta.security ?? meta.access.security,
      category,
      access.securityLevel,
    )
    const baseDocumentKey = normalizeDocumentKey(title, category)
    const documentKey = meta.personalFolderId
      ? `personal-${meta.personalFolderId}-${baseDocumentKey}`
      : baseDocumentKey
    const fileChecksum = await this.sha256File(file.path)
    const previousLatest = await this.documents.findOne(
      { documentKey, isLatestVersion: true },
      { sort: { version: -1 } },
    )
    const version = (previousLatest?.version ?? 0) + 1
    const doc: DocumentDoc = {
      docId: file.filename.replace(/\.[^.]+$/, ''),
      documentKey,
      title,
      category,
      originalName: file.originalname,
      storedName: file.filename,
      storagePath: file.path,
      mimeType: file.mimetype,
      size: file.size,
      fileChecksum,
      version,
      isLatestVersion: true,
      previousVersionDocId: previousLatest?.docId ?? null,
      securityLevel: access.securityLevel,
      scopeType: access.scopeType,
      accessRoleCodes: access.scopeType === 'role' ? access.roleCodes : [],
      accessDepartmentCodes:
        access.scopeType === 'department' ? access.departmentCodes : [],
      accessUserIds: access.scopeType === 'custom' ? access.userIds : [],
      uploadedById: user.userId,
      uploadedByName: user.name,
      createdAt: now,
      updatedAt: now,
      ingestStatus: 'pending',
      ingestStage: 'queued',
      ingestUpdatedAt: now,
      documentType: security.documentType,
      domain: security.domain,
      publicationStatus: security.publicationStatus,
      aiAccessPolicy: security.aiAccessPolicy,
      ownerUnit: security.ownerUnit,
      tags: security.tags,
      domainMetadata: security.domainMetadata,
      ...(meta.personalFolderId ? { personalFolderId: meta.personalFolderId } : {}),
    }
    await this.documents.insertOne(doc)
    await this.documentVersions.insertOne({
      versionId: `${doc.docId}-v${version}`,
      docId: doc.docId,
      documentKey,
      version,
      title: doc.title,
      category: doc.category,
      originalName: doc.originalName,
      storagePath: doc.storagePath,
      size: doc.size,
      fileChecksum,
      securityLevel: doc.securityLevel,
      scopeType: doc.scopeType,
      uploadedById: doc.uploadedById,
      uploadedByName: doc.uploadedByName,
      createdAt: now,
    })
    if (previousLatest) {
      await this.documents.updateOne(
        { docId: previousLatest.docId },
        { $set: { isLatestVersion: false, updatedAt: now } },
      )
    }

    try {
      await this.ingestQueue.enqueue({
        documentId: doc.docId,
        storagePath: doc.storagePath,
        title: doc.title,
        mimeType: doc.mimeType,
        securityLevel: doc.securityLevel,
        scopeType: doc.scopeType,
        accessRoleCodes: doc.accessRoleCodes,
        accessDepartmentCodes: doc.accessDepartmentCodes,
        accessUserIds: doc.accessUserIds,
        uploadedById: doc.uploadedById,
        documentType: doc.documentType,
        domain: doc.domain,
        publicationStatus: doc.publicationStatus,
        aiAccessPolicy: doc.aiAccessPolicy,
        ownerUnit: doc.ownerUnit,
        tags: doc.tags,
        domainMetadata: doc.domainMetadata,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Không gửi được job ingest.'
      await this.documents.updateOne(
        { docId: doc.docId },
        {
          $set: {
            ingestStatus: 'failed',
            ingestStage: 'queue',
            ingestError: message.slice(0, 500),
            ingestUpdatedAt: new Date(),
          },
        },
      )
      doc.ingestStatus = 'failed'
      doc.ingestStage = 'queue'
      doc.ingestError = message.slice(0, 500)
    }

    return this.toDto(doc)
  }

  private isPrivileged(user: RequestUser): boolean {
    return user.roles?.some((r) => ADMIN_ROLES.includes(r)) ?? false
  }

  /** Người dùng có được xem tài liệu này không (mức mật + phạm vi). */
  private canView(doc: DocumentDoc, user: RequestUser): boolean {
    // Personal-folder documents are private even from privileged/admin roles.
    if (doc.personalFolderId) return doc.uploadedById === user.userId
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
      .find({
        isLatestVersion: { $ne: false },
        personalFolderId: { $exists: false },
      })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray()
    return rows.filter((d) => this.canView(d, user)).map((d) => this.toDto(d))
  }

  async listByPersonalFolder(folderId: string, ownerUserId: string) {
    this.ensureReady()
    const rows = await this.documents
      .find({
        personalFolderId: folderId,
        uploadedById: ownerUserId,
        isLatestVersion: { $ne: false },
      })
      .sort({ createdAt: -1 })
      .toArray()
    return rows.map((doc) => this.toDto(doc))
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

  async getIngestStatus(docId: string, user: RequestUser) {
    this.ensureReady()
    const doc = await this.documents.findOne({ docId })
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.')
    if (!this.canView(doc, user)) {
      throw new ForbiddenException('Bạn không có quyền xem tài liệu này.')
    }
    return {
      document_id: doc.docId,
      status: doc.ingestStatus ?? 'pending',
      stage: doc.ingestStage ?? null,
      chunk_count: doc.chunkCount ?? 0,
      error: doc.ingestError ?? null,
      updated_at: doc.ingestUpdatedAt?.toISOString() ?? null,
    }
  }

  async getIngestStatuses(docIds: string[], user: RequestUser) {
    this.ensureReady()
    const normalizedIds = Array.from(
      new Set(docIds.map((value) => value.trim()).filter(Boolean)),
    ).slice(0, 100)

    if (normalizedIds.length === 0) {
      return { documents: [] }
    }

    const docs = await this.documents
      .find({ docId: { $in: normalizedIds } })
      .toArray()
    const byId = new Map(docs.map((doc) => [doc.docId, doc]))

    return {
      documents: normalizedIds.flatMap((docId) => {
        const doc = byId.get(docId)
        if (!doc || !this.canView(doc, user)) return []
        return [
          {
            document_id: doc.docId,
            status: doc.ingestStatus ?? 'pending',
            stage: doc.ingestStage ?? null,
            chunk_count: doc.chunkCount ?? 0,
            error: doc.ingestError ?? null,
            updated_at: doc.ingestUpdatedAt?.toISOString() ?? null,
          },
        ]
      }),
    }
  }

  /**
   * Get first N child/parent chunks of a document for preview.
   */
  async getChunks(
    docId: string,
    user: RequestUser,
    limit = 5,
    chunkType: 'child' | 'parent' = 'child',
  ): Promise<{ chunks: any[]; total: number }> {
    this.ensureReady()
    const doc = await this.documents.findOne({ docId })
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.')
    if (!this.canView(doc, user)) {
      throw new ForbiddenException('Bạn không có quyền xem tài liệu này.')
    }

    const chunks = await this.db
      .collection('document_chunks')
      .find(
        {
          documentId: docId,
          chunkType: chunkType,
        },
        {
          sort: { chunkIndex: 1, createdAt: 1 },
          limit,
          projection: {
            chunkId: 1,
            chunkText: 1,
            chunkIndex: 1,
            metadata: 1,
            createdAt: 1,
          },
        },
      )
      .toArray()

    const total = await this.db
      .collection('document_chunks')
      .countDocuments({ documentId: docId, chunkType: chunkType })

    return {
      chunks: chunks.map((c) => ({
        id: c.chunkId,
        text: c.chunkText,
        index: c.chunkIndex,
        section_path: c.metadata?.section_path || null,
        page: c.metadata?.page || null,
        created_at: c.createdAt?.toISOString?.() || null,
      })),
      total,
    }
  }

  async remove(docId: string, user: RequestUser): Promise<{ deleted: true }> {
    this.ensureReady()
    const doc = await this.documents.findOne({ docId })
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.')

    const isOwner = doc.uploadedById === user.userId
    if (doc.personalFolderId && !isOwner) {
      throw new ForbiddenException('Chỉ chủ sở hữu được xóa tài liệu cá nhân này.')
    }
    if (!isOwner && !this.isPrivileged(user)) {
      throw new ForbiddenException('Bạn không có quyền xóa tài liệu này.')
    }

    await this.documents.deleteOne({ docId })
    await this.documentVersions.deleteMany({ docId })
    await this.db.collection('document_chunks').deleteMany({ documentId: docId })
    await this.db.collection('processing_jobs').deleteMany({ documentId: docId })
    if (existsSync(doc.storagePath)) {
      await unlink(doc.storagePath).catch(() => {})
    }
    if (doc.isLatestVersion && doc.documentKey) {
      const fallback = await this.documents.findOne(
        { documentKey: doc.documentKey, docId: { $ne: docId } },
        { sort: { version: -1 } },
      )
      if (fallback) {
        await this.documents.updateOne(
          { docId: fallback.docId },
          { $set: { isLatestVersion: true, updatedAt: new Date() } },
        )
      }
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
      file_checksum: d.fileChecksum ?? null,
      version: d.version ?? 1,
      is_latest_version: d.isLatestVersion ?? true,
      security_level: d.securityLevel,
      scope_type: d.scopeType,
      access_role_codes: d.accessRoleCodes,
      access_department_codes: d.accessDepartmentCodes,
      access_user_ids: d.accessUserIds,
      uploaded_by: d.uploadedByName,
      uploaded_by_id: d.uploadedById,
      created_at: d.createdAt.toISOString(),
      ingest_status: d.ingestStatus ?? 'pending',
      ingest_stage: d.ingestStage ?? null,
      chunk_count: d.chunkCount ?? 0,
      ingest_error: d.ingestError ?? null,
      document_type: d.documentType ?? 'document',
      domain: d.domain ?? 'general',
      publication_status: d.publicationStatus ?? defaultPublicationStatus(d.securityLevel),
      ai_access_policy: d.aiAccessPolicy ?? defaultAiAccessPolicy(d.securityLevel),
      owner_unit: d.ownerUnit ?? '',
      tags: d.tags ?? [],
      domain_metadata: d.domainMetadata ?? {},
      personal_folder_id: d.personalFolderId ?? null,
    }
  }

  /**
   * Get comprehensive Vùng Dữ Liệu (Data Region) information
   * Shows what documents the user can and cannot access with reasons
   */
  async getVungDuLieu(user: RequestUser) {
    this.ensureReady();
    
    // Get ALL documents (no filtering)
    const allDocs = await this.documents.find({}).toArray();
    
    // Split into accessible and inaccessible
    const accessibleDocs = allDocs.filter(d => this.canView(d, user));
    const inaccessibleDocs = allDocs.filter(d => !this.canView(d, user));
    
    // Count by security level
    const levels: SecurityLevel[] = ['public', 'internal', 'restricted', 'confidential'];
    const levelNames: Record<SecurityLevel, string> = {
      public: 'Công khai',
      internal: 'Nội bộ',
      restricted: 'Hạn chế',
      confidential: 'Mật'
    };
    
    const bySecurityLevel = levels.map(level => {
      const docsAtLevel = allDocs.filter(d => (d.securityLevel || 'internal') === level);
      const accessible = docsAtLevel.filter(d => this.canView(d, user)).length;
      return {
        level,
        name: levelNames[level],
        total: docsAtLevel.length,
        accessible,
        inaccessible: docsAtLevel.length - accessible
      };
    });
    
    // Count by category
    const allCategories = [...new Set(allDocs.map(d => d.category || 'Khác'))];
    const byCategory = allCategories.map(cat => {
      const docsInCat = allDocs.filter(d => (d.category || 'Khác') === cat);
      const accessible = docsInCat.filter(d => this.canView(d, user)).length;
      return {
        category: cat,
        total: docsInCat.length,
        accessible,
        inaccessible: docsInCat.length - accessible
      };
    });
    
    // Count by source (sample vs upload)
    const sampleDocs = allDocs.filter(d => (d as any).isSample === true);
    const uploadDocs = allDocs.filter(d => (d as any).isSample !== true);
    
    // Build inaccessible reasons summary
    const reasonSummary = {
      bySecurityLevel: {} as Record<string, number>,
      byRole: {} as Record<string, number>,
      byDepartment: {} as Record<string, number>,
    };
    
    inaccessibleDocs.forEach(doc => {
      const level = doc.securityLevel || 'internal';
      reasonSummary.bySecurityLevel[level] = (reasonSummary.bySecurityLevel[level] || 0) + 1;
      
      if (doc.scopeType === 'role') {
        doc.accessRoleCodes?.forEach(role => {
          reasonSummary.byRole[role] = (reasonSummary.byRole[role] || 0) + 1;
        });
      }
      
      if (doc.scopeType === 'department') {
        doc.accessDepartmentCodes?.forEach(dept => {
          reasonSummary.byDepartment[dept] = (reasonSummary.byDepartment[dept] || 0) + 1;
        });
      }
    });
    
    // Build list of inaccessible docs with reasons (limited to 20 for performance)
    const inaccessibleList = inaccessibleDocs.slice(0, 20).map(d => ({
      id: d.docId,
      title: d.title,
      securityLevel: d.securityLevel || 'internal',
      reason: this.getInaccessibleReason(d, user)
    }));
    
    // Count by scope type
    const scopeTypes: AccessScopeType[] = ['all', 'role', 'department', 'custom'];
    const byScope = scopeTypes.map(scope => {
      const docsWithScope = allDocs.filter(d => (d.scopeType || 'all') === scope);
      const accessible = docsWithScope.filter(d => this.canView(d, user)).length;
      return {
        scope,
        total: docsWithScope.length,
        accessible,
        inaccessible: docsWithScope.length - accessible
      };
    });
    
    return {
      user: {
        userId: user.userId,
        roles: user.roles || [],
        department: user.department || null,
        maxSecurityLevel: user.maxSecurityLevel || 1
      },
      summary: {
        total: allDocs.length,
        accessible: accessibleDocs.length,
        inaccessible: inaccessibleDocs.length,
        rate: allDocs.length > 0 
          ? Math.round((accessibleDocs.length / allDocs.length) * 100) 
          : 0
      },
      bySecurityLevel,
      byCategory,
      byScope,
      sampleDocs: {
        total: sampleDocs.length,
        accessible: sampleDocs.filter(d => this.canView(d, user)).length,
        inaccessible: sampleDocs.length - sampleDocs.filter(d => this.canView(d, user)).length
      },
      uploadDocs: {
        total: uploadDocs.length,
        accessible: uploadDocs.filter(d => this.canView(d, user)).length,
        inaccessible: uploadDocs.length - uploadDocs.filter(d => this.canView(d, user)).length
      },
      inaccessibleReasons: reasonSummary,
      inaccessibleList,
      // Only show full inaccessible count breakdown if admin
      ...(this.isPrivileged(user) ? {
        allInaccessible: inaccessibleDocs.map(d => ({
          id: d.docId,
          title: d.title,
          securityLevel: d.securityLevel,
          scopeType: d.scopeType,
          uploadedBy: d.uploadedByName,
          reason: this.getInaccessibleReason(d, user)
        }))
      } : {})
    };
  }

  /**
   * Get statistics by security level (simplified version for dashboard)
   */
  async getSecurityLevelStats(user: RequestUser) {
    this.ensureReady();
    
    const allDocs = await this.documents.find({}).toArray();
    const levels: SecurityLevel[] = ['public', 'internal', 'restricted', 'confidential'];
    const levelNames: Record<SecurityLevel, string> = {
      public: 'Công khai',
      internal: 'Nội bộ',
      restricted: 'Hạn chế',
      confidential: 'Mật'
    };
    
    return levels.map(level => {
      const docsAtLevel = allDocs.filter(d => (d.securityLevel || 'internal') === level);
      const accessible = docsAtLevel.filter(d => this.canView(d, user)).length;
      return {
        level,
        name: levelNames[level],
        total: docsAtLevel.length,
        accessible,
        inaccessible: docsAtLevel.length - accessible,
        userCanAccess: (user.maxSecurityLevel || 1) >= (SECURITY_RANK[level] || 2)
      };
    });
  }

  /**
   * Preview what a specific role can see (Admin only)
   */
  async previewRoleAccess(role: string) {
    this.ensureReady();
    
    // Create a fake user with the specified role
    const fakeUser: RequestUser = {
      userId: 'preview-user',
      roles: [role],
      department: null,
      maxSecurityLevel: ADMIN_ROLES.includes(role) ? 4 : 2,
    };
    
    const allDocs = await this.documents.find({}).toArray();
    const accessibleDocs = allDocs.filter(d => this.canView(d, fakeUser));
    
    return {
      role,
      total: allDocs.length,
      accessible: accessibleDocs.length,
      inaccessible: allDocs.length - accessibleDocs.length,
      rate: allDocs.length > 0 
        ? Math.round((accessibleDocs.length / allDocs.length) * 100) 
        : 0,
      documents: accessibleDocs.slice(0, 50).map(d => this.toDto(d))
    };
  }

  /**
   * Helper: Get explanation for why a user can't access a document
   */
  private getInaccessibleReason(doc: DocumentDoc, user: RequestUser): string {
    const level = doc.securityLevel || 'internal';
    const userLevel = user.maxSecurityLevel || 1;
    
    // Check security level first
    if (SECURITY_RANK[level] > userLevel) {
      return `Yêu cầu mức "${this.getLevelName(level)}" (bạn có mức "${this.getLevelNameByRank(userLevel)}")`;
    }
    
    // Check scope type
    if (doc.scopeType === 'role') {
      const roles = doc.accessRoleCodes?.join(', ') || 'không có';
      return `Chỉ dành cho vai trò: ${roles}`;
    }
    
    if (doc.scopeType === 'department') {
      const depts = doc.accessDepartmentCodes?.join(', ') || 'không có';
      return `Chỉ dành cho đơn vị: ${depts}`;
    }
    
    if (doc.scopeType === 'custom') {
      return 'Chỉ dành cho người dùng cụ thể';
    }
    
    return 'Không có quyền truy cập';
  }

  /**
   * Helper: Get Vietnamese name for security level
   */
  private getLevelName(level: SecurityLevel): string {
    const names: Record<SecurityLevel, string> = {
      public: 'Công khai',
      internal: 'Nội bộ',
      restricted: 'Hạn chế',
      confidential: 'Mật'
    };
    return names[level] || level;
  }

  /**
   * Helper: Get Vietnamese name for security rank
   */
  private getLevelNameByRank(rank: number): string {
    const names: Record<number, string> = {
      1: 'Công khai',
      2: 'Nội bộ',
      3: 'Hạn chế',
      4: 'Mật'
    };
    return names[rank] || 'Không xác định';
  }

  async updateScope(
    docId: string,
    access: AccessMeta,
    user: RequestUser,
  ): Promise<{ updated: true }> {
    this.ensureReady()
    const doc = await this.documents.findOne({ docId })
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu.')
    if (doc.personalFolderId) {
      throw new BadRequestException('Phân quyền của tài liệu trong folder cá nhân được hệ thống khóa cố định.')
    }

    const isAdmin = this.isPrivileged(user)
    if (!isAdmin && doc.uploadedById !== user.userId) {
      throw new ForbiddenException('Bạn không có quyền sửa quyền truy cập tài liệu này.')
    }
    if (!isAdmin && securityRank(access.securityLevel) > (user.maxSecurityLevel ?? 1)) {
      throw new ForbiddenException('Bạn không thể đặt mức mật cao hơn quyền truy cập của mình.')
    }

    const sanitized = this.sanitizeAccessMeta(access)
    const now = new Date()
    await this.documents.updateOne(
      { docId },
      {
        $set: {
          securityLevel: sanitized.securityLevel,
          scopeType: sanitized.scopeType,
          accessRoleCodes: sanitized.scopeType === 'role' ? sanitized.roleCodes : [],
          accessDepartmentCodes: sanitized.scopeType === 'department' ? sanitized.departmentCodes : [],
          accessUserIds: sanitized.scopeType === 'custom' ? sanitized.userIds : [],
          updatedAt: now,
        },
      },
    )

    const rank = securityRank(sanitized.securityLevel)
    await this.db.collection('document_chunks').updateMany(
      { documentId: docId },
      {
        $set: {
          'metadata.securityLevel': sanitized.securityLevel,
          'metadata.allowedRoles': sanitized.scopeType === 'role' ? sanitized.roleCodes : [],
          'metadata.allowedDepartments': sanitized.scopeType === 'department' ? sanitized.departmentCodes : [],
          'metadata.allowedUserIds': sanitized.scopeType === 'custom' ? sanitized.userIds : [],
          'metadata.scopeType': sanitized.scopeType,
          'metadata.securityRank': rank,
        },
      },
    )

    writeAuditLog({
      userId: user.userId,
      action: 'update_scope',
      resourceType: 'document',
      resourceId: docId,
      oldValue: {
        securityLevel: doc.securityLevel,
        scopeType: doc.scopeType,
        accessRoleCodes: doc.accessRoleCodes,
        accessDepartmentCodes: doc.accessDepartmentCodes,
        accessUserIds: doc.accessUserIds,
      },
      newValue: {
        securityLevel: sanitized.securityLevel,
        scopeType: sanitized.scopeType,
        accessRoleCodes: sanitized.scopeType === 'role' ? sanitized.roleCodes : [],
        accessDepartmentCodes: sanitized.scopeType === 'department' ? sanitized.departmentCodes : [],
        accessUserIds: sanitized.scopeType === 'custom' ? sanitized.userIds : [],
      },
      status: 'success',
    }).catch(() => {})

    return { updated: true }
  }

  /**
   * Stream a summary for a document.
   * Checks permission, fetches from cache if available, otherwise generates via rag-engine.
   */
  async summarizeStream(
    docId: string,
    user: RequestUser,
    res: Response,
  ): Promise<void> {
    initSse(res)

    try {
      // 1. Check permission
      const doc = await this.documents.findOne({ docId })
      if (!doc) {
        writeSseError(res, 'Không tìm thấy tài liệu.')
        return
      }
      if (!this.canView(doc, user)) {
        writeSseError(res, 'Bạn không có quyền xem tài liệu này.')
        return
      }

      // 2. Send meta event
      writeSseEvent(res, 'meta', {
        document_id: docId,
        title: doc.title || 'Tài liệu',
        route: 'summary',
      })

      // 3. Call rag-engine summarization endpoint
      const ragUrl = this.config.get<string>('RAG_ENGINE_URL', 'http://localhost:8000')
      const maxChars = Number(this.config.get('SUMMARY_MAX_CHARS', 1500)) || 1500;
      const url = `${ragUrl.replace(/\/+$/, '')}/v1/summarize/stream`
      const internalSecret = this.getInternalSecret();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (internalSecret) {
        headers['x-gateway-internal-secret'] = internalSecret;
      }

      const fetchRes = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          document_id: docId,
          user: {
            userId: user.userId,
            username: user.userId,
            roles: user.roles,
            department: user.department,
            maxSecurityLevel: user.maxSecurityLevel,
          },
          max_chars: maxChars,
        }),
      })

      if (!fetchRes.ok || !fetchRes.body) {
        const body = fetchRes.body ? await fetchRes.text() : ''
        throw new Error(`rag-engine /v1/summarize/stream ${fetchRes.status}: ${body.slice(0, 200)}`)
      }

      // 4. Proxy SSE events from rag-engine to the client
      const reader = fetchRes.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''

        for (const block of lines) {
          if (!block.trim()) continue
          const linesInBlock = block.split('\n')
          let event = 'message'
          let dataLines: string[] = []

          for (const line of linesInBlock) {
            if (line.startsWith('event:')) {
              event = line.slice(6).trim()
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).trim())
            }
          }

          if (dataLines.length === 0) continue
          const payload = JSON.parse(dataLines.join('\n'))

          if (event === 'token') {
            writeSseEvent(res, 'token', { delta: payload.delta })
          } else if (event === 'done') {
            writeSseEvent(res, 'done', {
              answer: payload.answer,
              route: 'summary',
            })
          } else if (event === 'error') {
            writeSseEvent(res, 'error', { message: payload.message })
          }
        }
      }

      res.end()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tạo tóm tắt.'
      writeSseError(res, message)
    }
  }

  /**
   * Proxy to rag-engine for non-streaming quiz generation.
   */
  async generateQuizzes(
    docId: string,
    user: RequestUser,
    type: string,
    count: number,
    difficulty: string,
    forceRefresh: boolean,
    res: Response,
  ): Promise<void> {
    const ragUrl = this.config.get<string>('RAG_ENGINE_URL', 'http://localhost:8000')
    const url = `${ragUrl.replace(/\/+$/, '')}/v1/quizzes`
    const internalSecret = this.config.get<string>('GATEWAY_INTERNAL_SHARED_SECRET')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (internalSecret) {
      headers['x-gateway-internal-secret'] = internalSecret
    }

    try {
      const fetchRes = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          document_id: docId,
          user: {
            userId: user.userId,
            username: user.userId,
            roles: user.roles,
            department: user.department,
            maxSecurityLevel: user.maxSecurityLevel,
          },
          type,
          count,
          difficulty,
          force_refresh: forceRefresh,
          max_chars: Number(this.config.get('QUIZ_MAX_CHARS', 2000)) || 2000,
        }),
      })
      const status = fetchRes.status
      const body = await fetchRes.text()
      res.status(status).send(body)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tạo bài tập.'
      res.status(500).json({ error: message })
    }
  }

  /**
   * Proxy to rag-engine for quiz status.
   */
  async getQuizStatus(
    docId: string,
    user: RequestUser,
    type: string,
    count: number,
    difficulty: string,
    res: Response,
  ): Promise<void> {
    const ragUrl = this.config.get<string>('RAG_ENGINE_URL', 'http://localhost:8000')
    const url = `${ragUrl.replace(/\/+$/, '')}/v1/quizzes/status?document_id=${encodeURIComponent(docId)}&type=${encodeURIComponent(type)}&count=${encodeURIComponent(count)}&difficulty=${encodeURIComponent(difficulty)}`
    const internalSecret = this.config.get<string>('GATEWAY_INTERNAL_SHARED_SECRET')
    
    // Set headers: Accept + Gateway user headers + internal secret
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'x-gateway-user-id': user.userId,
      'x-gateway-username': user.userId,
      'x-gateway-roles': (user.roles || []).join(','),
      'x-gateway-department': encodeURIComponent(user.department || ''),
      'x-gateway-max-security-level': String(user.maxSecurityLevel || 1),
    }
    if (internalSecret) {
      headers['x-gateway-internal-secret'] = internalSecret
    }

    try {
      const fetchRes = await fetch(url, { headers })
      const status = fetchRes.status
      const body = await fetchRes.text()
      res.status(status).send(body)
    } catch (err) {
      res.status(500).json({ error: 'Không thể kiểm tra trạng thái bài tập.' })
    }
  }
}
