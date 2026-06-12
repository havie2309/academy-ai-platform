import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import "./LoginPage.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Vui lòng nhập tên đăng nhập và mật khẩu.");
      return;
    }
    setLoading(true);
    try {
      const { access_token, user } = await authApi.login(username, password);
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("user", JSON.stringify(user));
      navigate("/chat");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đăng nhập thất bại.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-root">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-mark">EDUMIND</span>
          <p className="logo-sub">Trợ lý ảo khai thác dữ liệu học viện</p>

        </div>
        <h1 className="login-title">Đăng nhập</h1>
        <p className="login-sub">Vui lòng đăng nhập thông tin tài khoản để tiếp tục</p>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <label className="field-label" htmlFor="username">Tên đăng nhập</label>
          <input
            id="username"
            className="field-input"
            type="text"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            placeholder="username"
          />

          <label className="field-label" htmlFor="password">Mật khẩu</label>
          <input
            id="password"
            className="field-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="Nhập mật khẩu"
          />

          {error && <p className="login-error" role="alert">{error}</p>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? "Đang xác thực…" : "Đăng nhập"}
          </button>
        </form>

        <p className="login-footer">
          Hệ thống nội bộ — chỉ dành cho cán bộ, giảng viên và học viên được cấp quyền.
        </p>
      </div>
    </div>
  );
}