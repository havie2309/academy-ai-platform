import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Monitor,
  Save,
  Shield,
  User,
} from 'lucide-react'
import { accountApi, type AccountProfile } from '../api/account'
import { authApi } from '../api/auth'
import { formatRoleLabel } from '../lib/authz'

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Chưa có dữ liệu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('vi-VN')
}

function parseDeviceLabel(userAgent: string | null | undefined): string {
  const source =
    userAgent?.trim() ||
    (typeof navigator !== 'undefined' ? navigator.userAgent : '')

  if (!source) return 'Thiết bị hiện tại'

  const browser = source.includes('Edg/')
    ? 'Edge'
    : source.includes('Chrome/')
      ? 'Chrome'
      : source.includes('Firefox/')
        ? 'Firefox'
        : source.includes('Safari/') && !source.includes('Chrome/')
          ? 'Safari'
          : 'Trình duyệt'

  const os = source.includes('Windows')
    ? 'Windows'
    : source.includes('Mac OS X')
      ? 'macOS'
      : source.includes('Android')
        ? 'Android'
        : source.includes('iPhone') || source.includes('iPad')
          ? 'iOS'
          : source.includes('Linux')
            ? 'Linux'
            : 'Thiết bị'

  return `${browser} / ${os}`
}

export default function AccountPage() {
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  const [sessionSaving, setSessionSaving] = useState(false)
  const [sessionMessage, setSessionMessage] = useState<string | null>(null)

  const loadProfile = async () => {
    setLoading(true)
    setPageError(null)

    try {
      const nextProfile = await accountApi.getProfile()
      setProfile(nextProfile)
      setFullName(nextProfile.full_name ?? '')
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : 'Không tải được hồ sơ tài khoản.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProfile()
  }, [])

  const roleLabel = useMemo(() => {
    if (!profile?.roles?.length) return 'Chưa có vai trò'
    return profile.roles.map((role) => formatRoleLabel(role)).join(', ')
  }, [profile])

  const currentDeviceLabel = useMemo(
    () => parseDeviceLabel(profile?.current_session_user_agent),
    [profile?.current_session_user_agent],
  )

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileMessage(null)
    setPageError(null)

    const trimmedFullName = fullName.trim()
    if (!trimmedFullName) {
      setProfileMessage('Họ và tên không được để trống.')
      return
    }

    setProfileSaving(true)
    try {
      const updated = await accountApi.updateProfile(trimmedFullName)
      setProfile(updated)
      setFullName(updated.full_name ?? '')
      authApi.updateStoredUser({ full_name: updated.full_name ?? trimmedFullName })
      setProfileMessage('Đã lưu hồ sơ thành công.')
    } catch (error) {
      setProfileMessage(
        error instanceof Error ? error.message : 'Không lưu được hồ sơ.',
      )
    } finally {
      setProfileSaving(false)
    }
  }

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordError(null)
    setPasswordMessage(null)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Vui lòng nhập đầy đủ các trường mật khẩu.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Xác nhận mật khẩu mới chưa khớp.')
      return
    }

    setPasswordSaving(true)
    try {
      const result = await accountApi.changePassword(currentPassword, newPassword)
      setPasswordMessage(result.message)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : 'Không đổi được mật khẩu.',
      )
    } finally {
      setPasswordSaving(false)
    }
  }

  const logoutOtherDevices = async () => {
    setSessionSaving(true)
    setSessionMessage(null)

    try {
      const result = await accountApi.logoutOtherSessions()
      setSessionMessage(result.message)
      await loadProfile()
    } catch (error) {
      setSessionMessage(
        error instanceof Error
          ? error.message
          : 'Không đăng xuất được các thiết bị khác.',
      )
    } finally {
      setSessionSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50/50 p-6 md:p-8">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-800">
          <User className="text-blue-600" />
          Cài đặt tài khoản
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Quản lý hồ sơ cá nhân, mật khẩu và phiên đăng nhập.
        </p>
      </div>

      {pageError && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Loader2 className="mb-2 animate-spin" size={24} />
          <p className="text-sm font-medium">Đang tải hồ sơ tài khoản…</p>
        </div>
      ) : (
        <div className="max-w-4xl space-y-6">
          <form
            onSubmit={saveProfile}
            className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm"
          >
            <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                <User size={18} />
              </div>
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">
                  Hồ sơ cá nhân
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Cập nhật thông tin hiển thị của tài khoản.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-500">
                  Họ và tên
                </span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-blue-500"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-500">
                  Email đăng nhập
                </span>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500">
                  <Mail size={15} />
                  <span>{profile?.email ?? 'Chưa có email'}</span>
                </div>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-500">
                  Vai trò
                </span>
                <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-600">
                  {roleLabel}
                </div>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-500">
                  Đơn vị
                </span>
                <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-600">
                  {profile?.department ?? 'Chưa có đơn vị'}
                </div>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={profileSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {profileSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Lưu hồ sơ
              </button>
              {profileMessage && (
                <p className="text-sm text-slate-500">{profileMessage}</p>
              )}
            </div>
          </form>

          <form
            onSubmit={submitPassword}
            className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm"
          >
            <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                <KeyRound size={18} />
              </div>
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">
                  Đổi mật khẩu
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Mật khẩu mới cần khác mật khẩu hiện tại và có ít nhất 8 ký tự.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-500">
                  Mật khẩu hiện tại
                </span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-blue-500"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-500">
                  Mật khẩu mới
                </span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-blue-500"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-500">
                  Xác nhận mật khẩu mới
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-blue-500"
                />
              </label>
            </div>

            {(passwordError || passwordMessage) && (
              <div
                className={`mt-4 rounded-xl border px-3 py-2 text-sm ${
                  passwordError
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                {passwordError ?? passwordMessage}
              </div>
            )}

            <div className="mt-5">
              <button
                type="submit"
                disabled={passwordSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {passwordSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <KeyRound size={16} />
                )}
                Đổi mật khẩu
              </button>
            </div>
          </form>

          <section className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                <Shield size={18} />
              </div>
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">
                  Bảo mật đăng nhập
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Theo dõi phiên hiện tại và chủ động đăng xuất các thiết bị khác.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Phiên đăng nhập hiện tại
                </p>
                <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Monitor size={15} className="text-blue-600" />
                  {currentDeviceLabel}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Lần đăng nhập gần nhất
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  {formatTimestamp(profile?.last_login_at)}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Thiết bị khác đang đăng nhập
              </p>
              <p className="mt-2 text-sm text-slate-700">
                {profile?.other_active_sessions_count ?? 0} thiết bị khác đang còn phiên hoạt động.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={logoutOtherDevices}
                  disabled={sessionSaving}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                >
                  {sessionSaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <LogOut size={16} />
                  )}
                  Đăng xuất khỏi thiết bị khác
                </button>
                {sessionMessage && (
                  <p className="text-sm text-slate-500">{sessionMessage}</p>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
