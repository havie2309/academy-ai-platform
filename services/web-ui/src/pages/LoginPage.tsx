import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { User, Lock, AlertCircle, GraduationCap, LogIn } from "lucide-react";
import { isAdminLikeRole } from "../lib/authz";
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
      const isAdmin = isAdminLikeRole(user.roles);
      navigate(isAdmin ? "/admin" : "/chat");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đăng nhập thất bại.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function enterAsGuest() {
    // Clear any existing session (optional)
    authApi.clearLocalSession();
    // Navigate to chat – the app will treat as anonymous
    navigate("/chat");
  }

  return (
    <div className="login-root" data-testid="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon-wrapper">
            <GraduationCap size={24} />
          </div>
          <span className="logo-mark">EduMind</span>
          <p className="logo-sub">Trợ lý ảo nội bộ học viện</p>
        </div>

        <h1 className="login-title">Đăng nhập</h1>
        <p className="login-sub">Nhập thông tin tài khoản của bạn để tiếp tục</p>

        <form onSubmit={handleSubmit} className="login-form" noValidate data-testid="login-form">
          <div className="field-group">
            <label className="field-label" htmlFor="username">Tên đăng nhập</label>
            <div className="input-wrapper">
              <input
                id="username"
                data-testid="login-username"
                className="field-input"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                placeholder="Nhập tên đăng nhập"
              />
              <User size={16} className="input-icon" />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="password">Mật khẩu</label>
            <div className="input-wrapper">
              <input
                id="password"
                data-testid="login-password"
                className="field-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="Nhập mật khẩu"
              />
              <Lock size={16} className="input-icon" />
            </div>
          </div>

          {error && (
            <div className="login-error" role="alert" data-testid="login-error">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button className="login-btn" type="submit" disabled={loading} data-testid="login-submit">
            {loading ? "Đang xác thực…" : "Đăng nhập"}
          </button>
        </form>

        <div className="login-divider">
          <span>hoặc</span>
        </div>

        <button
          type="button"
          className="guest-btn"
          onClick={enterAsGuest}
          data-testid="login-guest"
        >
          <LogIn size={16} />
          Tiếp tục với tư cách khách
        </button>

        <p className="login-footer">
          Hệ thống nội bộ — chỉ dành cho cán bộ, giảng viên và học viên được cấp quyền.
        </p>
      </div>
    </div>
  );
}