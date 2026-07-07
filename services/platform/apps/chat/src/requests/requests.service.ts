import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Collection, Db, MongoClient, ObjectId } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { IngestQueueService } from '../ingest/ingest-queue.service'
import { writeAuditLog } from '../../../../src/common/audit-log'

export interface UploadedFileLike {
  originalname: string
  path: string
  mimetype: string
  size: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_ROLES = ['ADMIN', 'Admin', 'BGD', 'P2']

/** Map loại tài liệu → category cho ingest pipeline */
const TYPE_TO_CATEGORY: Record<string, string> = {
  'Biểu mẫu': 'form',
  'Giáo trình, tài liệu dạy học': 'academic',
  'Tài liệu thu thập từ các nguồn': 'reference',
  'Đề tài, chuyên đề': 'research',
  'Tạp chí': 'journal',
}

/** Map zone id → domain cho ingest metadata */
const ZONE_TO_DOMAIN: Record<string, string> = {
  dt: 'dao-tao',
  kt: 'khao-thi',
  qs: 'khoa-hoc-quan-su',
  vn: 'vien-nghien-cuu',
  tv: 'thu-vien',
}

/** Map cấp độ mật (UI string) → securityLevel cho ingest */
const LEVEL_TO_SECURITY: Record<string, string> = {
  'Công khai': 'public',
  'Nội bộ': 'internal',
  'Hạn chế': 'restricted',
  'Mật': 'confidential',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RequestFileMeta {
  code?: string
  name?: string
  author?: string
  country?: string
  published?: string
  org?: string
  field?: string
  level?: string
}

export interface RequestFile extends RequestFileMeta {
  fileId: string
  storagePath: string
  originalName: string
  mimeType: string
  size: number
  documentId?: string
  ingestStatus: 'pending' | 'processing' | 'done' | 'failed'
}

export interface DocRequest {
  _id?: ObjectId
  requestId: string
  type: string
  zone: string
  desc: string
  status: 'pending' | 'processing' | 'done' | 'rejected'
  createdAt: Date
  createdBy: { userId: string; username: string }
  approvedBy?: { userId: string; username: string }
  approvedAt?: Date
  rejectedAt?: Date
  rejectionReason?: string
  files: RequestFile[]
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class RequestsService implements OnModuleInit {
  private readonly logger = new Logger(RequestsService.name)
  private client!: MongoClient
  private db!: Db
  private col!: Collection<DocRequest>
  private docsCol!: Collection

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
    this.col = this.db.collection<DocRequest>('document_requests')
    this.docsCol = this.db.collection('documents')

    await this.col.createIndex({ createdAt: -1 })
    await this.col.createIndex({ zone: 1, status: 1 })
    await this.col.createIndex({ 'createdBy.userId': 1 })
    this.logger.log('RequestsService connected to MongoDB')

    // Reconcile stuck 'processing' requests every 2 minutes
    this._scheduleReconciler()
  }

  private _scheduleReconciler() {
    setTimeout(() => {
      this._reconcileProcessing().catch((err) =>
        this.logger.warn(`Reconciler error: ${err instanceof Error ? err.message : String(err)}`),
      )
    }, 30_000) // first run after 30s (give pipeline time to start)

    setInterval(() => {
      this._reconcileProcessing().catch((err) =>
        this.logger.warn(`Reconciler error: ${err instanceof Error ? err.message : String(err)}`),
      )
    }, 120_000) // then every 2 minutes
  }

  private async _reconcileProcessing() {
    // Only look at requests that have been in 'processing' for > 2 minutes
    const cutoff = new Date(Date.now() - 2 * 60 * 1000)
    const stuckRequests = await this.col
      .find({ status: 'processing', approvedAt: { $lte: cutoff } })
      .toArray()

    if (stuckRequests.length === 0) return
    this.logger.log(`Reconciler: found ${stuckRequests.length} stuck request(s)`)

    for (const req of stuckRequests) {
      try {
        await this._syncRequestStatus(req)
      } catch (err) {
        this.logger.warn(`Reconciler: failed to sync ${req.requestId}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  private async _syncRequestStatus(doc: DocRequest) {
    let synced = 0
    for (const file of doc.files) {
      if (file.ingestStatus === 'done' || file.ingestStatus === 'failed') continue

      const docRecord = await this.docsCol.findOne(
        { requestId: doc.requestId, requestFileId: file.fileId },
        { projection: { docId: 1, ingestStatus: 1 } },
      )
      if (!docRecord) continue

      const ingestStatus = docRecord.ingestStatus as string
      const fileStatus =
        ingestStatus === 'completed' ? 'done' :
        ingestStatus === 'failed' ? 'failed' : null

      if (fileStatus) {
        await this.col.updateOne(
          { _id: doc._id, 'files.fileId': file.fileId },
          { $set: { 'files.$.ingestStatus': fileStatus, 'files.$.documentId': docRecord.docId } },
        )
        synced++
      }
    }

    if (synced === 0) return

    const updated = await this.col.findOne({ _id: doc._id })
    if (updated && updated.files.every((f) => f.ingestStatus === 'done' || f.ingestStatus === 'failed')) {
      await this.col.updateOne({ _id: updated._id }, { $set: { status: 'done' } })
      this.logger.log(`Reconciler: closed request ${doc.requestId} (synced ${synced} files)`)
    } else {
      this.logger.log(`Reconciler: partial sync for ${doc.requestId} (${synced} files updated)`)
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async generateRequestId(zone: string): Promise<string> {
    const now = new Date()
    const dd = String(now.getDate()).padStart(2, '0')
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const yy = String(now.getFullYear()).slice(-2)
    const dateStr = `${dd}${mm}${yy}`
    const zoneAbbr = zone.toUpperCase()

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const count = await this.col.countDocuments({ createdAt: { $gte: todayStart } })
    return `YC_${zoneAbbr}_${dateStr}_${count + 1}`
  }

  private isAdmin(roles: string[]) {
    return roles.some((r) => ADMIN_ROLES.includes(r))
  }

  private resolveDoc(id: string) {
    try {
      return this.col.findOne({ _id: new ObjectId(id) })
    } catch {
      return this.col.findOne({ requestId: id })
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  async create(
    files: UploadedFileLike[],
    body: { type: string; zone: string; desc?: string; files_meta?: string },
    user: { userId: string; username: string },
  ) {
    if (!files.length) throw new BadRequestException('Chưa có file nào được tải lên.')
    if (!body.type) throw new BadRequestException('Loại tài liệu là bắt buộc.')
    if (!body.zone) throw new BadRequestException('Vùng dữ liệu là bắt buộc.')

    let filesMeta: RequestFileMeta[] = []
    if (body.files_meta) {
      try {
        filesMeta = JSON.parse(body.files_meta)
      } catch {
        // ignore, use empty meta
      }
    }

    const requestId = await this.generateRequestId(body.zone)

    const requestFiles: RequestFile[] = files.map((f, i) => {
      const fm = filesMeta[i] ?? {}
      return {
        fileId: uuidv4(),
        code: fm.code ?? '',
        name: fm.name ?? f.originalname,
        author: fm.author ?? '',
        country: fm.country ?? '',
        published: fm.published ?? '',
        org: fm.org ?? '',
        field: fm.field ?? '',
        level: fm.level ?? 'Nội bộ',
        storagePath: f.path,
        originalName: f.originalname,
        mimeType: f.mimetype,
        size: f.size,
        ingestStatus: 'pending',
      }
    })

    const doc: DocRequest = {
      requestId,
      type: body.type,
      zone: body.zone,
      desc: body.desc ?? '',
      status: 'pending',
      createdAt: new Date(),
      createdBy: user,
      files: requestFiles,
    }

    await this.col.insertOne(doc)
    this.logger.log(`Created request ${requestId} with ${files.length} files by ${user.username}`)

    return {
      requestId,
      status: 'pending',
      files: requestFiles.length,
      createdAt: doc.createdAt,
    }
  }

  async list(
    filters: { zone?: string; status?: string; search?: string },
    user: { userId: string; roles: string[] },
  ) {
    const query: Record<string, unknown> = {}
    if (filters.zone) query.zone = filters.zone
    if (filters.status) query.status = filters.status
    if (filters.search) {
      query.$or = [
        { requestId: { $regex: filters.search, $options: 'i' } },
        { desc: { $regex: filters.search, $options: 'i' } },
        { type: { $regex: filters.search, $options: 'i' } },
      ]
    }
    if (!this.isAdmin(user.roles)) {
      query['createdBy.userId'] = user.userId
    }

    const docs = await this.col.find(query).sort({ createdAt: -1 }).toArray()
    return docs.map((d) => ({
      id: d._id!.toString(),
      requestId: d.requestId,
      type: d.type,
      zone: d.zone,
      desc: d.desc,
      status: d.status,
      files: d.files.length,
      createdAt: d.createdAt,
      by: d.createdBy.username,
    }))
  }

  async getOne(id: string, user: { userId: string; roles: string[] }) {
    const doc = await this.resolveDoc(id)
    if (!doc) throw new NotFoundException('Không tìm thấy yêu cầu')
    if (!this.isAdmin(user.roles) && doc.createdBy.userId !== user.userId) {
      throw new ForbiddenException('Không có quyền xem yêu cầu này')
    }
    const { files, _id, ...rest } = doc
    return { ...rest, id: _id!.toString(), uploads: files }
  }

  async approve(id: string, user: { userId: string; username: string; roles: string[] }) {
    if (!this.isAdmin(user.roles)) {
      throw new ForbiddenException('Chỉ quản trị viên mới có thể phê duyệt')
    }

    const doc = await this.resolveDoc(id)
    if (!doc) throw new NotFoundException('Không tìm thấy yêu cầu')
    if (doc.status !== 'pending') {
      throw new BadRequestException(`Yêu cầu đang ở trạng thái "${doc.status}", không thể duyệt`)
    }

    await this.col.updateOne(
      { _id: doc._id },
      {
        $set: {
          status: 'processing',
          approvedBy: { userId: user.userId, username: user.username },
          approvedAt: new Date(),
        },
      },
    )

    const category = TYPE_TO_CATEGORY[doc.type] ?? 'reference'
    const domain = ZONE_TO_DOMAIN[doc.zone] ?? 'general'

    const results = await Promise.allSettled(
      doc.files.map((f) => this._ingestFile(doc, f, category, domain)),
    )

    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) {
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          this.logger.error(`Ingest enqueue failed for file[${i}] of ${doc.requestId}: ${r.reason}`)
        }
      })
    }
    this.logger.log(`Approved ${doc.requestId}: ${doc.files.length - failed} queued, ${failed} failed`)

    writeAuditLog({
      userId: user.userId,
      action: 'approve_request',
      resourceType: 'document_request',
      resourceId: doc.requestId,
      newValue: {
        requestId: doc.requestId,
        type: doc.type,
        zone: doc.zone,
        approvedBy: user.username,
        filesTotal: doc.files.length,
        filesIngested: doc.files.length - failed,
        filesFailed: failed,
      },
      status: failed === doc.files.length ? 'failure' : 'success',
    }).catch(() => {})

    return {
      requestId: doc.requestId,
      status: 'processing',
      ingested: doc.files.length - failed,
      failed,
    }
  }

  private async _ingestFile(
    doc: DocRequest,
    f: RequestFile,
    category: string,
    domain: string,
  ) {
    const securityLevel = LEVEL_TO_SECURITY[f.level ?? ''] ?? 'internal'

    const docRecord = {
      docId: uuidv4(),
      title: f.name || f.originalName,
      originalName: f.originalName,
      storedName: f.originalName,
      storagePath: f.storagePath,
      mimeType: f.mimeType,
      size: f.size,
      category,
      domain,
      securityLevel,
      scopeType: 'all',
      accessRoleCodes: [] as string[],
      accessDepartmentCodes: [] as string[],
      accessUserIds: [] as string[],
      uploadedById: doc.createdBy.userId,
      uploadedByName: doc.createdBy.username,
      requestId: doc.requestId,
      requestFileId: f.fileId,
      ownerUnit: f.org ?? '',
      tags: [doc.type, doc.zone, ...(f.field ? [f.field] : [])],
      documentType: doc.type,
      publicationStatus: securityLevel === 'public' ? 'public' : 'internal',
      aiAccessPolicy: securityLevel === 'confidential' ? 'deny' : 'allow',
      ingestStatus: 'pending' as const,
      ingestStage: null,
      ingestError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.docsCol.insertOne(docRecord)
    const documentId = docRecord.docId

    await this.col.updateOne(
      { _id: doc._id, 'files.fileId': f.fileId },
      { $set: { 'files.$.documentId': documentId, 'files.$.ingestStatus': 'pending' } },
    )

    await this.ingestQueue.enqueue({
      documentId,
      storagePath: f.storagePath,
      title: f.name || f.originalName,
      mimeType: f.mimeType,
      securityLevel,
      scopeType: 'all',
      accessRoleCodes: [],
      accessDepartmentCodes: [],
      accessUserIds: [],
      uploadedById: doc.createdBy.userId,
      documentType: doc.type,
      domain,
      ownerUnit: f.org ?? '',
      tags: docRecord.tags,
    })

    this.logger.log(`Queued ingest: file=${f.fileId} → doc=${documentId}`)
  }

  async syncStatus(id: string, user: { userId: string; roles: string[] }) {
    if (!this.isAdmin(user.roles)) {
      throw new ForbiddenException('Chỉ quản trị viên mới có thể đồng bộ trạng thái.')
    }

    const doc = await this.resolveDoc(id)
    if (!doc) throw new NotFoundException('Không tìm thấy yêu cầu')
    if (doc.status !== 'processing') {
      return { requestId: doc.requestId, status: doc.status, synced: 0 }
    }

    await this._syncRequestStatus(doc)

    const updated = await this.resolveDoc(id)
    return { requestId: doc.requestId, status: updated?.status ?? doc.status }
  }

  async reject(
    id: string,
    user: { userId: string; roles: string[] },
    reason?: string,
  ) {
    if (!this.isAdmin(user.roles)) {
      throw new ForbiddenException('Chỉ quản trị viên mới có thể từ chối')
    }

    const doc = await this.resolveDoc(id)
    if (!doc) throw new NotFoundException('Không tìm thấy yêu cầu')
    if (doc.status !== 'pending') {
      throw new BadRequestException(`Yêu cầu đang ở trạng thái "${doc.status}"`)
    }

    await this.col.updateOne(
      { _id: doc._id },
      {
        $set: {
          status: 'rejected',
          rejectedAt: new Date(),
          rejectionReason: reason ?? '',
        },
      },
    )

    writeAuditLog({
      userId: user.userId,
      action: 'reject_request',
      resourceType: 'document_request',
      resourceId: doc.requestId,
      newValue: {
        requestId: doc.requestId,
        type: doc.type,
        zone: doc.zone,
        reason: reason ?? '',
      },
      status: 'success',
    }).catch(() => {})

    return { requestId: doc.requestId, status: 'rejected' }
  }
}
