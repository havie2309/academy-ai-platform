import { fetchWithAuth } from './http'

async function parseError(res: Response): Promise<string> {
  if (res.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  }

  const body = await res.json().catch(() => ({}))
  const msg = (body as { message?: string | string[] }).message
  if (Array.isArray(msg)) return msg.join(', ')
  return msg ?? `Lỗi API (${res.status})`
}

export interface AccountProfile {
  user_id: string
  username: string
  email: string
  full_name: string | null
  department: string | null
  max_security_level: number
  roles: string[]
  last_login_at: string | null
  current_session_user_agent: string | null
  other_active_sessions_count: number
}

export const accountApi = {
  async getProfile(): Promise<AccountProfile> {
    const res = await fetchWithAuth('/api/users/me/account', {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async updateProfile(fullName: string): Promise<AccountProfile> {
    const res = await fetchWithAuth('/api/users/me/account', {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ full_name: fullName }),
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const res = await fetchWithAuth('/api/users/me/change-password', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async logoutOtherSessions(): Promise<{
    message: string
    revoked_count: number
  }> {
    const res = await fetchWithAuth('/api/users/me/logout-other-sessions', {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },
}
