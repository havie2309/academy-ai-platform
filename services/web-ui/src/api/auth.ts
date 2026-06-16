import { apiUrl } from './base';
const USE_MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';

export interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    username: string;
    full_name: string;
    roles: string[];
    unit_id: string | null;
  };
}

const mockUsers: Record<string, LoginResponse> = {
  admin: { access_token: 'mock', user: { id: '1', username: 'admin', full_name: 'Quản trị viên', roles: ['Admin'], unit_id: null } },
  gv001: { access_token: 'mock', user: { id: '2', username: 'gv001', full_name: 'Nguyễn Văn A', roles: ['GiangVien'], unit_id: 'P2' } },
  hv001: { access_token: 'mock', user: { id: '3', username: 'hv001', full_name: 'Trần Thị B', roles: ['HocVien'], unit_id: 'P2' } },
  p2:    { access_token: 'mock', user: { id: '4', username: 'p2', full_name: 'Cán bộ P2', roles: ['P2'], unit_id: 'P2' } },
};

export const authApi = {
  async login(username: string, password: string): Promise<LoginResponse> {
    if (USE_MOCK_AUTH) {
      if (mockUsers[username] && password === '123456') return mockUsers[username];
      throw new Error('Tên đăng nhập hoặc mật khẩu không đúng.');
    }

    const res = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { message?: string }).message ?? 'Tên đăng nhập hoặc mật khẩu không đúng.');
    }
    return res.json();
  },

  async logout(): Promise<void> {
    const token = this.getToken();
    if (!USE_MOCK_AUTH && token) {
      await fetch(apiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  },

  getToken(): string | null {
    return localStorage.getItem('access_token');
  },

  getUser(): LoginResponse['user'] | null {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};

export interface GatewayHealth {
  status: string;
  service: string;
  timestamp: string;
  upstream: { userManagement: 'up' | 'down'; chat?: 'up' | 'down' };
}

export async function fetchGatewayHealth(): Promise<GatewayHealth | null> {
  try {
    const res = await fetch(apiUrl('/api/health'));
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
