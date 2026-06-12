const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

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

export const authApi = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? "Tên đăng nhập hoặc mật khẩu không đúng.");
    }
    return res.json();
  },

  logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
  },

  getToken(): string | null {
    return localStorage.getItem("access_token");
  },

  getUser(): LoginResponse["user"] | null {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};