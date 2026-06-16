import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export interface IngestJobPayload {
  documentId: string
  storagePath: string
  title: string
  mimeType: string
  securityLevel: string
  scopeType: string
  accessRoleCodes: string[]
  accessDepartmentCodes: string[]
  accessUserIds: string[]
  uploadedById: string
}

@Injectable()
export class IngestQueueService {
  private readonly logger = new Logger(IngestQueueService.name)
  private readonly processorUrl: string

  constructor(private readonly config: ConfigService) {
    this.processorUrl = (
      this.config.get<string>('DOCUMENT_PROCESSOR_URL') ??
      'http://localhost:8003'
    ).replace(/\/+$/, '')
  }

  async enqueue(job: IngestJobPayload): Promise<void> {
    const res = await fetch(`${this.processorUrl}/v1/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(job),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(
        `Document processor lỗi (${res.status}): ${text.slice(0, 200)}`,
      )
    }
    this.logger.log(`Submitted ingest job documentId=${job.documentId}`)
  }
}
