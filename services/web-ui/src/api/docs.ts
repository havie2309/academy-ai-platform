import { fetchWithAuth } from './http'

async function parseError(res: Response): Promise<string> {
  if (res.status === 401) {
    return 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.'
  }
  const body = await res.json().catch(() => ({}))
  const msg = (body as { message?: string | string[] }).message
  if (Array.isArray(msg)) return msg.join(', ')
  return msg ?? `Lỗi API (${res.status})`
}

export type SecurityLevel = 'public' | 'internal' | 'restricted' | 'confidential'
export type AccessScopeType = 'all' | 'role' | 'department' | 'custom'

export type PublicationStatus = 'public' | 'internal' | 'confidential' | 'embargoed'
export type AiAccessPolicy = 'allow' | 'deny' | 'restricted' | 'review_required'

export interface DocumentSecurityConfig {
  document_type?: string
  domain?: string
  publication_status?: PublicationStatus
  ai_access_policy?: AiAccessPolicy
  owner_unit?: string
  tags?: string[]
  domain_metadata?: Record<string, unknown>
  personal_folder_id?: string | null
}

export interface AccessConfig {
  security_level: SecurityLevel
  scope_type: AccessScopeType
  role_codes?: string[]
  department_codes?: string[]
  user_ids?: string[]
  security?: DocumentSecurityConfig
}

export type IngestStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface DocItem {
  id: string
  title: string
  category: string
  original_name: string
  mime_type: string
  size: number
  file_checksum?: string | null
  version?: number
  is_latest_version?: boolean
  security_level: SecurityLevel
  scope_type: AccessScopeType
  access_role_codes: string[]
  access_department_codes: string[]
  access_user_ids: string[]
  uploaded_by: string
  uploaded_by_id: string
  created_at: string
  ingest_status?: IngestStatus
  ingest_stage?: string | null
  chunk_count?: number
  ingest_error?: string | null
  document_type?: string
  domain?: string
  publication_status?: PublicationStatus
  ai_access_policy?: AiAccessPolicy
  owner_unit?: string
  tags?: string[]
  domain_metadata?: Record<string, unknown>
}

export interface IngestStatusResponse {
  document_id: string
  status: IngestStatus
  stage: string | null
  chunk_count: number
  error: string | null
  updated_at: string | null
}

export interface IngestStatusesResponse {
  documents: IngestStatusResponse[]
}

// ============================================================
// VÙNG DỮ LIỆU - Types
// ============================================================

export interface VungDuLieuUser {
  userId: string
  roles: string[]
  department: string | null
  maxSecurityLevel: number
}

export interface VungDuLieuSummary {
  total: number
  accessible: number
  inaccessible: number
  rate: number
}

export interface VungDuLieuSecurityLevel {
  level: string
  name: string
  total: number
  accessible: number
  inaccessible: number
}

export interface VungDuLieuCategory {
  category: string
  total: number
  accessible: number
  inaccessible: number
}

export interface VungDuLieuScope {
  scope: string
  total: number
  accessible: number
  inaccessible: number
}

export interface VungDuLieuSourceStats {
  total: number
  accessible: number
  inaccessible: number
}

export interface VungDuLieuInaccessibleReasons {
  bySecurityLevel: Record<string, number>
  byRole: Record<string, number>
  byDepartment: Record<string, number>
}

export interface VungDuLieuInaccessibleItem {
  id: string
  title: string
  securityLevel: string
  reason: string
}

export interface VungDuLieuData {
  user: VungDuLieuUser
  summary: VungDuLieuSummary
  bySecurityLevel: VungDuLieuSecurityLevel[]
  byCategory: VungDuLieuCategory[]
  byScope: VungDuLieuScope[]
  sampleDocs: VungDuLieuSourceStats
  uploadDocs: VungDuLieuSourceStats
  inaccessibleReasons: VungDuLieuInaccessibleReasons
  inaccessibleList: VungDuLieuInaccessibleItem[]
  // Optional: only for admins
  allInaccessible?: VungDuLieuInaccessibleItem[]
}

// ============================================================
// API Methods
// ============================================================

export const docsApi = {
  async list(): Promise<DocItem[]> {
    const res = await fetchWithAuth('/api/documents', {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(await parseError(res))
    const data = await res.json()
    return Array.isArray(data) ? data : []
  },

  async upload(
    file: File,
    meta: {
      title?: string
      category?: string
      access: AccessConfig
      security?: DocumentSecurityConfig
    },
  ): Promise<DocItem> {
    const form = new FormData()
    const security = meta.security ?? meta.access.security
    form.append('file', file)
    if (meta.title) form.append('title', meta.title)
    if (meta.category) form.append('category', meta.category)
    form.append('security_level', meta.access.security_level)
    form.append('scope_type', meta.access.scope_type)
    if (meta.access.role_codes?.length)
      form.append('access_role_codes', meta.access.role_codes.join(','))
    if (meta.access.department_codes?.length)
      form.append('access_department_codes', meta.access.department_codes.join(','))
    if (meta.access.user_ids?.length)
      form.append('access_user_ids', meta.access.user_ids.join(','))
    if (security?.document_type) form.append('document_type', security.document_type)
    if (security?.domain) form.append('domain', security.domain)
    if (security?.publication_status)
      form.append('publication_status', security.publication_status)
    if (security?.ai_access_policy)
      form.append('ai_access_policy', security.ai_access_policy)
    if (security?.owner_unit) form.append('owner_unit', security.owner_unit)
    if (security?.tags?.length) form.append('tags', security.tags.join(','))
    if (security?.domain_metadata && Object.keys(security.domain_metadata).length > 0) {
      form.append('domain_metadata', JSON.stringify(security.domain_metadata))
    }

    const res = await fetchWithAuth('/api/documents', {
      method: 'POST',
      body: form,
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async remove(id: string): Promise<void> {
    const res = await fetchWithAuth(`/api/documents/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error(await parseError(res))
  },

  async updateScope(
    id: string,
    scope: {
      security_level: SecurityLevel
      scope_type: AccessScopeType
      access_role_codes?: string
      access_department_codes?: string
      access_user_ids?: string
    },
  ): Promise<void> {
    const res = await fetchWithAuth(`/api/documents/${id}/scope`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scope),
    })
    if (!res.ok) throw new Error(await parseError(res))
  },

  /** Tải file (kèm token) về dạng blob để xem/lưu, vì <a href> không gửi header auth. */
  async fetchBlob(id: string): Promise<Blob> {
    const res = await fetchWithAuth(`/api/documents/${id}/file`)
    if (!res.ok) throw new Error(await parseError(res))
    return res.blob()
  },

  async ingestStatus(id: string): Promise<IngestStatusResponse> {
    const res = await fetchWithAuth(`/api/documents/${id}/ingest-status`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async ingestStatuses(ids: string[]): Promise<IngestStatusesResponse> {
    const query = new URLSearchParams()
    for (const id of ids) {
      const normalized = id.trim()
      if (!normalized) continue
      query.append('ids', normalized)
    }
    const suffix = query.toString()
    const res = await fetchWithAuth(
      `/api/documents/ingest-statuses${suffix ? `?${suffix}` : ''}`,
      {
        headers: { Accept: 'application/json' },
      },
    )
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  /**
   * Get preview chunks for a document
   */
  async getChunks(
    id: string,
    limit = 5,
    chunkType: 'child' | 'parent' = 'child',
    chunkIds?: string[],
  ): Promise<{
    chunks: Array<{
      id: string
      text: string
      index: number
      section_path: string | null
      page: number | null
      created_at: string | null
    }>
    total: number
  }> {
    const params = new URLSearchParams()
    params.append('limit', String(limit))
    if (chunkType) {
      params.append('chunkType', chunkType)
    }
    if (chunkIds?.length) {
      chunkIds.forEach((cid) => params.append('chunk_ids', cid))
    }
    const res = await fetchWithAuth(`/api/documents/${id}/chunks?${params}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  // ============================================================
  // VÙNG DỮ LIỆU - NEW API Method
  // ============================================================

  /**
   * Get Vùng Dữ Liệu (Data Region) information.
   * Shows what documents the current user can and cannot access,
   * with breakdowns by security level, category, and reasons for denial.
   */
  async getVungDuLieu(): Promise<VungDuLieuData> {
    const res = await fetchWithAuth('/api/documents/vung-du-lieu', {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  // ============================================================
  // OPTIONAL: Additional stats endpoints
  // ============================================================

  /**
   * Get simplified security level statistics.
   * Useful for smaller dashboard widgets.
   */
  async getSecurityLevelStats(): Promise<VungDuLieuSecurityLevel[]> {
    const res = await fetchWithAuth('/api/documents/security-level-stats', {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  /**
   * Preview what a specific role can access (Admin only).
   */
  async previewRoleAccess(role: string): Promise<{
    role: string
    total: number
    accessible: number
    inaccessible: number
    rate: number
    documents: DocItem[]
  }> {
    const res = await fetchWithAuth(
      `/api/documents/preview/${encodeURIComponent(role)}`,
      { headers: { Accept: 'application/json' } },
    )
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  /**
   * Stream a summary for a document.
   * Returns a Response object with a readable stream (SSE).
   */
  async summarizeStream(id: string, signal?: AbortSignal): Promise<Response> {
    return fetchWithAuth(`/api/documents/${id}/summarize/stream`, {
      method: 'POST',
      headers: { Accept: 'text/event-stream' },
      signal,
    })
  },

  /**
   * Generate quizzes for a document (non-streaming).
   * Returns the parsed quizzes array.
   */
  async generateQuizzes(
    id: string,
    options: { type: string; count: number; difficulty: string; force_refresh?: boolean }
  ): Promise<any[]> {
    const res = await fetchWithAuth(`/api/documents/${id}/quizzes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    })
    if (!res.ok) throw new Error(await parseError(res))
    const data = await res.json()
    return data.quizzes || []
  },

  /**
   * Get the status of an quiz generation job for a document and settings.
   */
  async getQuizStatus(
    id: string,
    options: { type: string; count: number; difficulty: string }
  ): Promise<{ status: 'completed' | 'running' | 'not_found'; quizzes?: any[] }> {
    const params = new URLSearchParams({
      document_id: id,
      type: options.type,
      count: String(options.count),
      difficulty: options.difficulty,
    })
    const res = await fetchWithAuth(`/api/documents/${id}/quizzes/status?${params}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  }
}
