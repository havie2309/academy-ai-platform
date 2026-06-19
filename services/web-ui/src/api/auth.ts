import { apiUrl } from './base'

const USE_MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true'

export interface LoginResponse {
  access_token: string
  user: {
    id: string
    username: string
    full_name: string
    roles: string[]
    unit_id: string | null
  }
}

const mockUsers: Record<string, LoginResponse> = {
  admin: {
    access_token: 'mock',
    user: {
      id: '1',
      username: 'admin',
      full_name: 'Quan tri vien',
      roles: ['ADMIN'],
      unit_id: null,
    },
  },
  gv001: {
    access_token: 'mock',
    user: {
      id: '2',
      username: 'gv001',
      full_name: 'Nguyen Van A',
      roles: ['GIANG_VIEN'],
      unit_id: 'P2',
    },
  },
  hv001: {
    access_token: 'mock',
    user: {
      id: '3',
      username: 'hv001',
      full_name: 'Tran Thi B',
      roles: ['HOC_VIEN'],
      unit_id: 'P2',
    },
  },
  p2: {
    access_token: 'mock',
    user: {
      id: '4',
      username: 'p2',
      full_name: 'Can bo P2',
      roles: ['P2'],
      unit_id: 'P2',
    },
  },
}

export const authApi = {
  async login(username: string, password: string): Promise<LoginResponse> {
    if (USE_MOCK_AUTH) {
      if (mockUsers[username] && password === '123456') {
        return mockUsers[username]
      }
      throw new Error('Ten dang nhap hoac mat khau khong dung.')
    }

    const res = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(
        (body as { message?: string }).message ??
          'Ten dang nhap hoac mat khau khong dung.',
      )
    }
    return res.json()
  },

  async refresh(): Promise<string | null> {
    if (USE_MOCK_AUTH) return this.getToken()

    const res = await fetch(apiUrl('/api/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) {
      this.clearLocalSession()
      return null
    }

    const data = (await res.json()) as LoginResponse
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token)
    }
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user))
    }
    return data.access_token ?? null
  },

  async logout(): Promise<void> {
    const token = this.getToken()
    if (!USE_MOCK_AUTH && token) {
      await fetch(apiUrl('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    this.clearLocalSession()
  },

  clearLocalSession(): void {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
  },

  getToken(): string | null {
    return localStorage.getItem('access_token')
  },

  getUser(): LoginResponse['user'] | null {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  },

  isAuthenticated(): boolean {
    return !!this.getToken()
  },
}
