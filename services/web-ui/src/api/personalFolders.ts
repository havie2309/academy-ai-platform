import { fetchWithAuth } from './http'
import type { DocItem } from './docs'

async function parseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}))
  const message = (body as { message?: string | string[] }).message
  return Array.isArray(message) ? message.join(', ') : (message ?? `Lỗi API (${res.status})`)
}

export interface PersonalFolder {
  id: string
  name: string
  description: string
  document_count: number
  created_at: string
  updated_at: string
}

export const personalFoldersApi = {
  async list(): Promise<PersonalFolder[]> {
    const res = await fetchWithAuth('/api/personal-folders')
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async get(id: string): Promise<PersonalFolder> {
    const res = await fetchWithAuth(`/api/personal-folders/${id}`)
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async create(name: string, description = ''): Promise<PersonalFolder> {
    const res = await fetchWithAuth('/api/personal-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async remove(id: string): Promise<void> {
    const res = await fetchWithAuth(`/api/personal-folders/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await parseError(res))
  },

  async listDocuments(id: string): Promise<DocItem[]> {
    const res = await fetchWithAuth(`/api/personal-folders/${id}/documents`)
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async uploadDocument(id: string, file: File, title?: string): Promise<DocItem> {
    const form = new FormData()
    form.append('file', file)
    if (title?.trim()) form.append('title', title.trim())
    const res = await fetchWithAuth(`/api/personal-folders/${id}/documents`, {
      method: 'POST',
      body: form,
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },
}
