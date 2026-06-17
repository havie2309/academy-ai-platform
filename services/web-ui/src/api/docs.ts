import { authApi } from './auth'
import { apiUrl } from './base'

function authHeader(): Record<string, string> {
  const token = authApi.getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

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

export interface AccessConfig {
  security_level: SecurityLevel
  scope_type: AccessScopeType
  role_codes?: string[]
  department_codes?: string[]
  user_ids?: string[]
}

export type IngestStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface DocItem {
  id: string
  title: string
  category: string
  original_name: string
  mime_type: string
  size: number
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
}

export interface IngestStatusResponse {
  document_id: string
  status: IngestStatus
  stage: string | null
  chunk_count: number
  error: string | null
  updated_at: string | null
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
    const res = await fetch(apiUrl('/api/documents'), {
      headers: { ...authHeader(), Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(await parseError(res))
    const data = await res.json()
    return Array.isArray(data) ? data : []
  },

  async upload(
    file: File,
    meta: { title?: string; category?: string; access: AccessConfig },
  ): Promise<DocItem> {
    const form = new FormData()
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

    const res = await fetch(apiUrl('/api/documents'), {
      method: 'POST',
      headers: authHeader(),
      body: form,
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async remove(id: string): Promise<void> {
    const res = await fetch(apiUrl(`/api/documents/${id}`), {
      method: 'DELETE',
      headers: authHeader(),
    })
    if (!res.ok) throw new Error(await parseError(res))
  },

  /** Tải file (kèm token) về dạng blob để xem/lưu, vì <a href> không gửi header auth. */
  async fetchBlob(id: string): Promise<Blob> {
    const res = await fetch(apiUrl(`/api/documents/${id}/file`), {
      headers: authHeader(),
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.blob()
  },

  async ingestStatus(id: string): Promise<IngestStatusResponse> {
    const res = await fetch(apiUrl(`/api/documents/${id}/ingest-status`), {
      headers: { ...authHeader(), Accept: 'application/json' },
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
    const res = await fetch(apiUrl('/api/documents/vung-du-lieu'), {
      headers: { ...authHeader(), Accept: 'application/json' },
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
    const res = await fetch(apiUrl('/api/documents/security-level-stats'), {
      headers: { ...authHeader(), Accept: 'application/json' },
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
    const res = await fetch(apiUrl(`/api/documents/preview/${encodeURIComponent(role)}`), {
      headers: { ...authHeader(), Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },
}