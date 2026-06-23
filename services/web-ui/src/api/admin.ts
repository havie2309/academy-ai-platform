import { apiUrl } from './base'
import { fetchWithAuth } from './http'

type ServiceState = 'up' | 'down'

export interface GatewayHealth {
  status: string
  service: string
  timestamp: string
  upstream: {
    userManagement: ServiceState
    chat: ServiceState
    rbac: ServiceState
    adminConfig: ServiceState
    audit: ServiceState
    rag: ServiceState
  }
}

export interface RagPolicyConfig {
  enabled: boolean
  blacklistKeywords: string[]
  safeRefusalMessage: string
}

export interface StoredAdminConfig<T> {
  config_key: string
  version: number
  updated_at: string
  value: T
}

export interface AuditLogEntry {
  id: number
  user_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  old_value: unknown
  new_value: unknown
  ip_address: string | null
  user_agent: string | null
  status: 'success' | 'failure' | 'denied'
  reason: string | null
  created_at: string
}

export interface AuditLogFilters {
  status?: string
  action?: string
  resourceType?: string
  userId?: string
  resourceId?: string
  from?: string
  to?: string
  limit?: number
}

function toSearchParams(filters: AuditLogFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.status?.trim()) params.set('status', filters.status.trim())
  if (filters.action?.trim()) params.set('action', filters.action.trim())
  if (filters.resourceType?.trim()) {
    params.set('resourceType', filters.resourceType.trim())
  }
  if (filters.userId?.trim()) params.set('userId', filters.userId.trim())
  if (filters.resourceId?.trim()) params.set('resourceId', filters.resourceId.trim())
  if (filters.from?.trim()) params.set('from', filters.from.trim())
  if (filters.to?.trim()) params.set('to', filters.to.trim())
  if (filters.limit) params.set('limit', String(filters.limit))
  return params
}

async function parseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}))
  const message = (body as { message?: string | string[] }).message
  if (Array.isArray(message)) return message.join(', ')
  return message ?? `Lỗi API (${res.status})`
}

export async function fetchGatewayHealth(): Promise<GatewayHealth | null> {
  try {
    const res = await fetch(apiUrl('/api/health'), {
      credentials: 'include',
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export const adminApi = {
  async getRagPolicy(): Promise<StoredAdminConfig<RagPolicyConfig>> {
    const res = await fetchWithAuth('/api/admin-config/rag-policy', {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async updateRagPolicy(input: {
    enabled: boolean
    blacklistKeywords: string[]
    safeRefusalMessage: string
    reason?: string
  }): Promise<StoredAdminConfig<RagPolicyConfig>> {
    const res = await fetchWithAuth('/api/admin-config/rag-policy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
    const params = toSearchParams(filters)
    const suffix = params.toString() ? `?${params.toString()}` : ''
    const res = await fetchWithAuth(`/api/audit/logs${suffix}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async getAuditLog(id: number | string): Promise<AuditLogEntry | null> {
    const res = await fetchWithAuth(`/api/audit/logs/${id}`, {
      headers: { Accept: 'application/json' },
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },
}
