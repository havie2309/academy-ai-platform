import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Ban,
  Gauge,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  Search,
  Shield,
  UserCheck,
  UserCog,
  Users,
} from 'lucide-react'
import {
  adminApi,
  type AdminOpsOverview,
  type ManagedAccount,
} from '../../api/admin'
import { authApi } from '../../api/auth'
import { formatRoleLabel } from '../../lib/authz'

const ROLE_OPTIONS = ['ADMIN', 'BGD', 'P2', 'P7', 'GIANG_VIEN', 'HOC_VIEN', 'KHAO_THI']

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('vi-VN')
}

function accountStatusLabel(status: ManagedAccount['status']): string {
  switch (status) {
    case 'active':
      return 'Đang hoạt động'
    case 'inactive':
      return 'Tạm ngưng'
    case 'locked':
      return 'Đã khóa'
    default:
      return status
  }
}

function accountStatusTone(status: ManagedAccount['status']): string {
  switch (status) {
    case 'active':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'inactive':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'locked':
      return 'border-red-200 bg-red-50 text-red-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600'
  }
}

export default function AdminOpsSection() {
  const currentUser = authApi.getUser()

  const [overview, setOverview] = useState<AdminOpsOverview | null>(null)
  const [accounts, setAccounts] = useState<ManagedAccount[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ManagedAccount['status']>('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const buildFilters = () => ({
    search: search.trim() || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    role: roleFilter === 'all' ? undefined : roleFilter,
    limit: 40,
  })

  const loadOverview = async () => {
    setOverviewLoading(true)
    try {
      setOverview(await adminApi.getOpsOverview())
    } finally {
      setOverviewLoading(false)
    }
  }

  const loadAccounts = async () => {
    setAccountsLoading(true)
    try {
      setAccounts(await adminApi.getManagedAccounts(buildFilters()))
    } finally {
      setAccountsLoading(false)
    }
  }

  const loadAll = async () => {
    setError(null)
    await Promise.all([loadOverview(), loadAccounts()])
  }

  useEffect(() => {
    void loadAll().catch((nextError) => {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Không tải được dữ liệu quota/token/account ops.',
      )
    })
  }, [])

  const applyFilters = async () => {
    setError(null)
    setMessage(null)
    try {
      await loadAccounts()
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Không lọc được danh sách tài khoản.',
      )
    }
  }

  const resetFilters = async () => {
    setSearch('')
    setStatusFilter('all')
    setRoleFilter('all')
    setError(null)
    setMessage(null)
    setAccountsLoading(true)
    try {
      setAccounts(await adminApi.getManagedAccounts({ limit: 40 }))
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Không tải lại được danh sách tài khoản.',
      )
    } finally {
      setAccountsLoading(false)
    }
  }

  const runAction = async (
    key: string,
    action: () => Promise<{ message: string }>,
  ) => {
    setBusyKey(key)
    setError(null)
    setMessage(null)
    try {
      const result = await action()
      setMessage(result.message)
      await Promise.all([loadOverview(), loadAccounts()])
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Thao tác quản trị không thành công.',
      )
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section
      className="mt-6 rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm"
      data-testid="admin-ops-section"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <UserCog className="text-blue-600" size={18} />
            Quota, token và quản lý tài khoản
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi policy rate-limit, usage của refresh token/session và thao tác khóa,
            mở khóa hoặc thu hồi phiên của tài khoản người dùng.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadAll().catch((nextError) => {
              setError(
                nextError instanceof Error
                  ? nextError.message
                  : 'Không tải lại được quota/token/account ops.',
              )
            })
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white"
        >
          <RefreshCw size={15} />
          Làm mới quản trị
        </button>
      </div>

      {(error || message) && (
        <div className="mt-5 space-y-3">
          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 shrink-0" size={16} />
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <UserCheck className="mt-0.5 shrink-0" size={16} />
              <span>{message}</span>
            </div>
          )}
        </div>
      )}

      {overview && (!overview.sources.mongo_available || !overview.sources.redis_available) && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertCircle className="mt-0.5 shrink-0" size={16} />
          <span>
            {!overview.sources.mongo_available
              ? 'MongoDB chưa sẵn sàng nên usage chat đang hiển thị ở mức 0.'
              : 'Redis chưa sẵn sàng nên không đọc được khóa tạm thời do đăng nhập sai.'}
          </span>
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Tổng tài khoản
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {overviewLoading ? '...' : overview?.account_summary.total_users ?? 0}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Admin-like: {overview?.account_summary.admin_like_users ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Tài khoản cần lưu ý
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {overviewLoading
              ? '...'
              : (overview?.account_summary.locked_users ?? 0) +
                (overview?.account_summary.temporary_locked_users ?? 0)}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            DB locked: {overview?.account_summary.locked_users ?? 0} · Redis lock:{' '}
            {overview?.account_summary.temporary_locked_users ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Refresh token đang hoạt động
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {overviewLoading ? '...' : overview?.token_summary.active_refresh_sessions ?? 0}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Hết hạn trong 24h: {overview?.token_summary.sessions_expiring_24h ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Login lỗi 24h
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {overviewLoading ? '...' : overview?.usage_summary.failed_logins_24h ?? 0}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Refresh 24h: {overview?.token_summary.refreshes_24h ?? 0}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Gauge className="text-blue-600" size={16} />
            Chính sách quota / guardrail
          </h3>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-slate-500">Rate limit user đăng nhập</dt>
              <dd className="mt-1 font-semibold text-slate-800">
                {overview?.quota_policy.rate_limit_auth_per_minute ?? 0}/phút
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-slate-500">Rate limit anonymous</dt>
              <dd className="mt-1 font-semibold text-slate-800">
                {overview?.quota_policy.rate_limit_anon_per_minute ?? 0}/phút
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-slate-500">Load shedding</dt>
              <dd className="mt-1 font-semibold text-slate-800">
                {overview?.quota_policy.load_shedding_max_concurrent ?? 0} request đồng thời
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-slate-500">TTL access / refresh</dt>
              <dd className="mt-1 font-semibold text-slate-800">
                {overview?.quota_policy.access_token_ttl ?? '...'} /{' '}
                {overview?.quota_policy.refresh_token_ttl_days ?? 0} ngày
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Shield className="text-blue-600" size={16} />
            Tín hiệu sử dụng gần đây
          </h3>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-slate-500">Chat sessions 7 ngày</dt>
              <dd className="mt-1 font-semibold text-slate-800">
                {overview?.usage_summary.chat_sessions_7d ?? 0}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-slate-500">Chat messages 7 ngày</dt>
              <dd className="mt-1 font-semibold text-slate-800">
                {overview?.usage_summary.chat_messages_7d ?? 0}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-slate-500">Người dùng chat hoạt động</dt>
              <dd className="mt-1 font-semibold text-slate-800">
                {overview?.usage_summary.active_chat_users_7d ?? 0}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-slate-500">Login thành công 24h</dt>
              <dd className="mt-1 font-semibold text-slate-800">
                {overview?.usage_summary.successful_logins_24h ?? 0}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Users className="text-blue-600" size={16} />
              Quản lý tài khoản
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Tìm kiếm, lọc trạng thái và thao tác trên phiên refresh token của người dùng.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm username, họ tên, email, đơn vị"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as 'all' | ManagedAccount['status'])
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            >
              <option value="all">Mọi trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Tạm ngưng</option>
              <option value="locked">Đã khóa</option>
            </select>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            >
              <option value="all">Mọi vai trò</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {formatRoleLabel(role)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void applyFilters()}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Áp dụng
            </button>
            <button
              type="button"
              onClick={() => void resetFilters()}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Đặt lại
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                <th className="px-3">Tài khoản</th>
                <th className="px-3">Vai trò / trạng thái</th>
                <th className="px-3">Token / bảo mật</th>
                <th className="px-3">Sử dụng</th>
                <th className="px-3">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {accountsLoading && (
                <tr>
                  <td colSpan={5} className="rounded-2xl bg-white px-4 py-6 text-sm text-slate-500">
                    Đang tải danh sách tài khoản...
                  </td>
                </tr>
              )}

              {!accountsLoading && accounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="rounded-2xl bg-white px-4 py-6 text-sm text-slate-500">
                    Không có tài khoản nào khớp bộ lọc hiện tại.
                  </td>
                </tr>
              )}

              {!accountsLoading &&
                accounts.map((account) => {
                  const isSelf = currentUser?.id === account.user_id
                  return (
                    <tr
                      key={account.user_id}
                      data-testid={`account-row-${account.user_id}`}
                      className="rounded-2xl bg-white shadow-sm"
                    >
                      <td className="rounded-l-2xl px-3 py-4 align-top">
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-800">{account.full_name || account.username}</p>
                          <p className="text-sm text-slate-500">{account.username}</p>
                          <p className="text-xs text-slate-400">{account.email}</p>
                          <p className="text-xs text-slate-400">
                            {account.department || 'Chưa có đơn vị'} · Mức mật {account.max_security_level}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          {(account.roles.length > 0 ? account.roles : ['Không có vai trò']).map((role) => (
                            <span
                              key={role}
                              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                            >
                              {formatRoleLabel(role)}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${accountStatusTone(
                              account.status,
                            )}`}
                          >
                            {accountStatusLabel(account.status)}
                          </span>
                          {account.temporary_locked && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                              Redis lock
                            </span>
                          )}
                          {isSelf && (
                            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-700">
                              Bạn
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4 align-top text-sm text-slate-600">
                        <p className="font-semibold text-slate-800">
                          {account.active_refresh_sessions} phiên refresh đang mở
                        </p>
                        <p className="mt-1">Refresh 7 ngày: {account.refreshes_7d}</p>
                        <p className="mt-1">Login lỗi 7 ngày: {account.failed_logins_7d}</p>
                        <p className="mt-1">
                          Gần nhất: {formatTimestamp(account.last_refreshed_at)}
                        </p>
                      </td>
                      <td className="px-3 py-4 align-top text-sm text-slate-600">
                        <p className="font-semibold text-slate-800">
                          {account.chat_sessions_total} chat sessions
                        </p>
                        <p className="mt-1">Tin nhắn 30 ngày: {account.chat_messages_30d}</p>
                        <p className="mt-1">Đăng nhập gần nhất: {formatTimestamp(account.last_login_at)}</p>
                        <p className="mt-1">Chat gần nhất: {formatTimestamp(account.last_chat_at)}</p>
                      </td>
                      <td className="rounded-r-2xl px-3 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busyKey !== null}
                            onClick={() =>
                              void runAction(
                                `active:${account.user_id}`,
                                () => adminApi.updateManagedAccountStatus(account.user_id, 'active'),
                              )
                            }
                            data-testid={`account-activate-${account.user_id}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <UserCheck size={14} />
                            Kích hoạt
                          </button>
                          <button
                            type="button"
                            disabled={busyKey !== null || isSelf}
                            onClick={() =>
                              void runAction(
                                `inactive:${account.user_id}`,
                                () =>
                                  adminApi.updateManagedAccountStatus(
                                    account.user_id,
                                    'inactive',
                                  ),
                              )
                            }
                            data-testid={`account-inactivate-${account.user_id}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Ban size={14} />
                            Tạm ngưng
                          </button>
                          <button
                            type="button"
                            disabled={busyKey !== null || isSelf}
                            onClick={() =>
                              void runAction(
                                `locked:${account.user_id}`,
                                () =>
                                  adminApi.updateManagedAccountStatus(
                                    account.user_id,
                                    'locked',
                                  ),
                              )
                            }
                            data-testid={`account-lock-${account.user_id}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <LockKeyhole size={14} />
                            Khóa
                          </button>
                          <button
                            type="button"
                            disabled={busyKey !== null}
                            onClick={() =>
                              void runAction(
                                `revoke:${account.user_id}`,
                                () =>
                                  adminApi.revokeManagedAccountSessions(account.user_id),
                              )
                            }
                            data-testid={`account-revoke-${account.user_id}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <KeyRound size={14} />
                            Thu hồi phiên
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
