import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Collection, Db, MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'

export interface PersonalFolderDoc {
  folderId: string
  ownerUserId: string
  name: string
  description: string
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class PersonalFoldersService implements OnModuleInit {
  private client!: MongoClient
  private db!: Db
  private folders!: Collection<PersonalFolderDoc>

  constructor(private readonly config: ConfigService) {}

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
    this.folders = this.db.collection<PersonalFolderDoc>('personal_folders')
    await this.folders.createIndex({ ownerUserId: 1, updatedAt: -1 })
    await this.folders.createIndex(
      { ownerUserId: 1, name: 1 },
      { unique: true, collation: { locale: 'vi', strength: 2 } },
    )
  }

  private ensureReady() {
    if (!this.folders) {
      throw new ServiceUnavailableException('Kho trợ lý cá nhân chưa sẵn sàng.')
    }
  }

  async list(ownerUserId: string) {
    this.ensureReady()
    const rows = await this.folders
      .find({ ownerUserId })
      .sort({ updatedAt: -1 })
      .toArray()
    const ids = rows.map((row) => row.folderId)
    const counts = ids.length
      ? await this.db
          .collection('documents')
          .aggregate<{ _id: string; count: number }>([
            { $match: { personalFolderId: { $in: ids }, isLatestVersion: { $ne: false } } },
            { $group: { _id: '$personalFolderId', count: { $sum: 1 } } },
          ])
          .toArray()
      : []
    const countById = new Map(counts.map((item) => [item._id, item.count]))
    return rows.map((row) => this.toDto(row, countById.get(row.folderId) ?? 0))
  }

  async create(ownerUserId: string, name?: string, description?: string) {
    this.ensureReady()
    const normalizedName = name?.trim()
    if (!normalizedName) throw new BadRequestException('Tên folder không được để trống.')
    if (normalizedName.length > 100) throw new BadRequestException('Tên folder tối đa 100 ký tự.')
    const now = new Date()
    const doc: PersonalFolderDoc = {
      folderId: uuidv4(),
      ownerUserId,
      name: normalizedName,
      description: description?.trim().slice(0, 500) ?? '',
      createdAt: now,
      updatedAt: now,
    }
    try {
      await this.folders.insertOne(doc)
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new BadRequestException('Bạn đã có một folder cùng tên.')
      }
      throw error
    }
    return this.toDto(doc, 0)
  }

  async getOwned(folderId: string, ownerUserId: string): Promise<PersonalFolderDoc> {
    this.ensureReady()
    const folder = await this.folders.findOne({ folderId, ownerUserId })
    if (!folder) throw new NotFoundException('Không tìm thấy folder cá nhân.')
    return folder
  }

  async get(folderId: string, ownerUserId: string) {
    const folder = await this.getOwned(folderId, ownerUserId)
    const documentCount = await this.db.collection('documents').countDocuments({
      personalFolderId: folderId,
      uploadedById: ownerUserId,
      isLatestVersion: { $ne: false },
    })
    return this.toDto(folder, documentCount)
  }

  async update(folderId: string, ownerUserId: string, name?: string, description?: string) {
    const folder = await this.getOwned(folderId, ownerUserId)
    const normalizedName = name?.trim() ?? folder.name
    if (!normalizedName) throw new BadRequestException('Tên folder không được để trống.')
    const now = new Date()
    await this.folders.updateOne(
      { folderId, ownerUserId },
      { $set: { name: normalizedName.slice(0, 100), description: description?.trim().slice(0, 500) ?? folder.description, updatedAt: now } },
    )
    return this.get(folderId, ownerUserId)
  }

  async remove(folderId: string, ownerUserId: string) {
    await this.getOwned(folderId, ownerUserId)
    const documentCount = await this.db.collection('documents').countDocuments({
      personalFolderId: folderId,
      uploadedById: ownerUserId,
    })
    if (documentCount > 0) {
      throw new BadRequestException('Hãy xóa hết tài liệu trong folder trước khi xóa folder.')
    }
    await this.db.collection('chat_sessions').updateMany(
      { personalFolderId: folderId, userId: ownerUserId, deletedAt: { $exists: false } },
      { $set: { deletedAt: new Date() } },
    )
    await this.folders.deleteOne({ folderId, ownerUserId })
    return { deleted: true }
  }

  async documentIds(folderId: string, ownerUserId: string): Promise<string[]> {
    await this.getOwned(folderId, ownerUserId)
    const docs = await this.db
      .collection<{ docId: string }>('documents')
      .find(
        {
          personalFolderId: folderId,
          uploadedById: ownerUserId,
          isLatestVersion: { $ne: false },
          ingestStatus: 'completed',
        },
        { projection: { docId: 1 } },
      )
      .toArray()
    return docs.map((doc) => doc.docId)
  }

  private toDto(folder: PersonalFolderDoc, documentCount: number) {
    return {
      id: folder.folderId,
      name: folder.name,
      description: folder.description,
      document_count: documentCount,
      created_at: folder.createdAt.toISOString(),
      updated_at: folder.updatedAt.toISOString(),
    }
  }
}
