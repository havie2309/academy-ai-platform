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

async function parseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}))
  const message = (body as { message?: string | string[] }).message
  if (Array.isArray(message)) return message.join(', ')
  return message ?? `Loi API (${res.status})`
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
}
