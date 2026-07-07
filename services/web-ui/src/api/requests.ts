import { fetchWithAuth } from './http'

export type RequestStatus = 'pending' | 'processing' | 'done' | 'rejected'

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

export interface RequestListItem {
  id: string
  requestId: string
  type: string
  zone: string
  desc: string
  status: RequestStatus
  files: number
  createdAt: string
  by: string
}

export interface RequestUploadDetail {
  fileId: string
  code: string
  name: string
  author: string
  country: string
  published: string
  org: string
  field: string
  level: string
  originalName: string
  mimeType: string
  size: number
  documentId?: string
  ingestStatus: string
}

export interface RequestDetail extends RequestListItem {
  createdBy: { userId: string; username: string }
  approvedBy?: { userId: string; username: string }
  approvedAt?: string
  rejectedAt?: string
  rejectionReason?: string
  uploads: RequestUploadDetail[]
}

async function parseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}))
  const msg = (body as { message?: string | string[] }).message
  if (Array.isArray(msg)) return msg.join(', ')
  return msg ?? `Lỗi API (${res.status})`
}

export const requestsApi = {
  async list(filters?: { zone?: string; status?: string; search?: string }): Promise<RequestListItem[]> {
    const params = new URLSearchParams()
    if (filters?.zone) params.set('zone', filters.zone)
    if (filters?.status) params.set('status', filters.status)
    if (filters?.search) params.set('search', filters.search)
    const qs = params.toString()
    const res = await fetchWithAuth(`/api/documents/requests${qs ? `?${qs}` : ''}`)
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async get(id: string): Promise<RequestDetail> {
    const res = await fetchWithAuth(`/api/documents/requests/${id}`)
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async create(
    files: File[],
    meta: { type: string; zone: string; desc?: string; filesMeta?: RequestFileMeta[] },
  ): Promise<{ requestId: string; status: string; files: number; createdAt: string }> {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    form.append('type', meta.type)
    form.append('zone', meta.zone)
    if (meta.desc) form.append('desc', meta.desc)
    if (meta.filesMeta?.length) form.append('files_meta', JSON.stringify(meta.filesMeta))
    const res = await fetchWithAuth('/api/documents/requests', { method: 'POST', body: form })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async approve(id: string): Promise<{ requestId: string; status: string; ingested: number }> {
    const res = await fetchWithAuth(`/api/documents/requests/${id}/approve`, { method: 'POST' })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async reject(id: string, reason?: string): Promise<{ requestId: string; status: string }> {
    const res = await fetchWithAuth(`/api/documents/requests/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason ?? '' }),
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async syncStatus(id: string): Promise<{ requestId: string; status: string }> {
    const res = await fetchWithAuth(`/api/documents/requests/${id}/sync-status`, { method: 'POST' })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },
}
