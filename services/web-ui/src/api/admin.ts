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

export interface AdminOpsOverview {
  generated_at: string
  quota_policy: {
    rate_limit_auth_per_minute: number
    rate_limit_anon_per_minute: number
    load_shedding_max_concurrent: number
    access_token_ttl: string
    refresh_token_ttl_days: number
    login_max_attempts: number
    login_lock_duration_seconds: number
  }
  account_summary: {
    total_users: number
    active_users: number
    inactive_users: number
    locked_users: number
    admin_like_users: number
    temporary_locked_users: number
  }
  token_summary: {
    active_refresh_sessions: number
    sessions_expiring_24h: number
    refreshes_24h: number
    revoked_sessions_24h: number
  }
  usage_summary: {
    failed_logins_24h: number
    successful_logins_24h: number
    chat_sessions_7d: number
    chat_messages_7d: number
    active_chat_users_7d: number
  }
  sources: {
    mongo_available: boolean
    redis_available: boolean
  }
}

export interface ManagedAccount {
  user_id: string
  username: string
  email: string
  full_name: string | null
  department: string | null
  max_security_level: number
  status: 'active' | 'inactive' | 'locked'
  roles: string[]
  last_login_at: string | null
  temporary_locked: boolean
  active_refresh_sessions: number
  last_refreshed_at: string | null
  failed_logins_7d: number
  refreshes_7d: number
  chat_sessions_total: number
  chat_messages_30d: number
  last_chat_at: string | null
}

export interface ManagedAccountFilters {
  search?: string
  status?: 'active' | 'inactive' | 'locked'
  role?: string
  limit?: number
}

export interface ManagedAccountMutationResult {
  message: string
  revoked_count: number
  account: ManagedAccount | null
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

function toAccountSearchParams(filters: ManagedAccountFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.search?.trim()) params.set('search', filters.search.trim())
  if (filters.status?.trim()) params.set('status', filters.status.trim())
  if (filters.role?.trim()) params.set('role', filters.role.trim())
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

  async getOpsOverview(): Promise<AdminOpsOverview> {
    const res = await fetchWithAuth('/api/users/admin/overview', {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async getManagedAccounts(
    filters: ManagedAccountFilters = {},
  ): Promise<ManagedAccount[]> {
    const params = toAccountSearchParams(filters)
    const suffix = params.toString() ? `?${params.toString()}` : ''
    const res = await fetchWithAuth(`/api/users/admin/accounts${suffix}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async updateManagedAccountStatus(
    userId: string,
    status: ManagedAccount['status'],
  ): Promise<ManagedAccountMutationResult> {
    const res = await fetchWithAuth(`/api/users/admin/accounts/${userId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async revokeManagedAccountSessions(
    userId: string,
  ): Promise<ManagedAccountMutationResult> {
    const res = await fetchWithAuth(
      `/api/users/admin/accounts/${userId}/revoke-sessions`,
      {
        method: 'POST',
        headers: { Accept: 'application/json' },
      },
    )
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },
}
