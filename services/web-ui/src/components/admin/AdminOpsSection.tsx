import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Ban,
  KeyRound,
  MessageSquare,
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
import AdminTechnicalDetails from './AdminTechnicalDetails'

const ROLE_OPTIONS = [
  'ADMIN',
  'BGD',
  'P2',
  'P7',
  'GIANG_VIEN',
  'HOC_VIEN',
  'KHAO_THI',
]

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

function formatAccessWindow(accessTokenTtl: string, refreshTokenTtlDays: number): string {
  return `${accessTokenTtl} / ${refreshTokenTtlDays} ngày`
}

function buildAccountLabel(account: ManagedAccount): string {
  return account.full_name || account.username
}

interface AdminOpsSectionProps {
  showSummaryCards?: boolean
  showTechnical?: boolean
  onViewChat?: (userId: string) => void
}

export default function AdminOpsSection({
  showSummaryCards = true,
  showTechnical = true,
  onViewChat,
}: AdminOpsSectionProps) {
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
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

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
          : 'Không tải được dữ liệu quản trị tài khoản.',
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
    setExpandedUserId(null)
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

  const confirmSensitiveAction = (
    title: string,
    description: string,
    impact: string,
  ): boolean => {
    return window.confirm(`${title}\n\n${description}\n\n${impact}`)
  }

  const accountsNeedingAttention = overview
    ? overview.account_summary.locked_users + overview.account_summary.temporary_locked_users
    : 0

  const suspendedOrLockedAccounts = overview
    ? overview.account_summary.inactive_users + overview.account_summary.locked_users
    : 0

  const openSessions = overview?.token_summary.active_refresh_sessions ?? 0
  const riskyLogins = overview?.usage_summary.failed_logins_24h ?? 0
  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((left, right) => {
      const leftIsSelf = left.user_id === currentUser?.id
      const rightIsSelf = right.user_id === currentUser?.id
      if (leftIsSelf !== rightIsSelf) return leftIsSelf ? -1 : 1

      const leftIsAdmin = left.roles.includes('ADMIN')
      const rightIsAdmin = right.roles.includes('ADMIN')
      if (leftIsAdmin !== rightIsAdmin) return leftIsAdmin ? -1 : 1

      return 0
    })
  }, [accounts, currentUser?.id])

  return (
    <section
      className="mt-6 rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm"
      data-testid="admin-ops-section"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <UserCog className="text-blue-600" size={18} />
            Tài khoản và phiên đăng nhập
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi các tài khoản cần xử lý, tình trạng khóa hoặc tạm ngưng và hỗ trợ
            thu hồi phiên đăng nhập khi cần.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadAll().catch((nextError) => {
              setError(
                nextError instanceof Error
                  ? nextError.message
                  : 'Không tải lại được dữ liệu quản trị tài khoản.',
              )
            })
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white"
        >
          <RefreshCw size={15} />
          Tải lại tài khoản
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
              ? 'MongoDB chưa sẵn sàng nên số liệu hoạt động trò chuyện có thể chưa đầy đủ.'
              : 'Redis chưa sẵn sàng nên trạng thái khóa tạm do đăng nhập sai có thể chưa phản ánh đủ.'}
          </span>
        </div>
      )}

      {showSummaryCards && (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Tài khoản cần xử lý
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {overviewLoading ? '...' : accountsNeedingAttention}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Đã khóa: {overview?.account_summary.locked_users ?? 0} · Tạm khóa do đăng nhập sai:{' '}
            {overview?.account_summary.temporary_locked_users ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Tài khoản bị khóa hoặc tạm ngưng
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {overviewLoading ? '...' : suspendedOrLockedAccounts}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Tạm ngưng: {overview?.account_summary.inactive_users ?? 0} · Đã khóa:{' '}
            {overview?.account_summary.locked_users ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Phiên đăng nhập đang mở
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {overviewLoading ? '...' : openSessions}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Sắp hết hạn trong 24 giờ: {overview?.token_summary.sessions_expiring_24h ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Đăng nhập cần kiểm tra
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {overviewLoading ? '...' : riskyLogins}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Đăng nhập thành công 24 giờ: {overview?.usage_summary.successful_logins_24h ?? 0}
          </p>
        </div>
        </div>
      )}

      {showTechnical && (
        <div className="mt-6">
          <AdminTechnicalDetails
            testId="admin-ops-technical"
            description="Giữ lại các chỉ số quota, thời hạn phiên và dữ liệu nguồn để hỗ trợ kiểm tra sâu khi cần."
          >
            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Shield className="text-blue-600" size={16} />
                    Giới hạn yêu cầu và chống quá tải
                  </h3>
                  <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">Giới hạn yêu cầu cho đăng nhập</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {overview?.quota_policy.rate_limit_auth_per_minute ?? 0}/phút
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Giới hạn yêu cầu ẩn danh</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {overview?.quota_policy.rate_limit_anon_per_minute ?? 0}/phút
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Ngưỡng chống quá tải</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {overview?.quota_policy.load_shedding_max_concurrent ?? 0} yêu cầu đồng thời
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Giới hạn đăng nhập sai</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {overview?.quota_policy.login_max_attempts ?? 0} lần
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-bold text-slate-800">Thời hạn phiên đăng nhập</h3>
                  <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">Access / refresh token</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {overview
                          ? formatAccessWindow(
                              overview.quota_policy.access_token_ttl,
                              overview.quota_policy.refresh_token_ttl_days,
                            )
                          : '...'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Khóa tạm sau khi đăng nhập sai</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {overview?.quota_policy.login_lock_duration_seconds ?? 0} giây
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-bold text-slate-800">Nguồn dữ liệu</h3>
                  <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">MongoDB</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {overview?.sources.mongo_available ? 'Sẵn sàng' : 'Chưa sẵn sàng'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Redis</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {overview?.sources.redis_available ? 'Sẵn sàng' : 'Chưa sẵn sàng'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-950 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Raw overview payload
                </p>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-100">
                  {overview ? JSON.stringify(overview, null, 2) : 'Chưa có dữ liệu'}
                </pre>
              </div>
            </div>
          </AdminTechnicalDetails>
        </div>
      )}

      <div
        className={`rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 ${
          showTechnical || showSummaryCards ? 'mt-6' : 'mt-5'
        }`}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Users className="text-blue-600" size={16} />
              Quản lý tài khoản
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Mặc định chỉ hiển thị các thông tin cần dùng hằng ngày. Chọn “Xem chi tiết”
              khi cần xem sâu hơn.
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
                placeholder="Tìm theo họ tên, email hoặc đơn vị"
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
                <th className="px-3">Họ tên</th>
                <th className="px-3">Email</th>
                <th className="px-3">Vai trò</th>
                <th className="px-3">Trạng thái</th>
                <th className="px-3">Đăng nhập gần nhất</th>
                <th className="px-3">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {accountsLoading && (
                <tr>
                  <td colSpan={6} className="rounded-2xl bg-white px-4 py-6 text-sm text-slate-500">
                    Đang tải danh sách tài khoản...
                  </td>
                </tr>
              )}

              {!accountsLoading && accounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="rounded-2xl bg-white px-4 py-6 text-sm text-slate-500">
                    Không có tài khoản nào khớp bộ lọc hiện tại.
                  </td>
                </tr>
              )}

              {!accountsLoading &&
                sortedAccounts.map((account) => {
                  const isExpanded = expandedUserId === account.user_id
                  const isSelf = currentUser?.id === account.user_id
                  const displayName = buildAccountLabel(account)
                  const canReactivate = account.status !== 'active'
                  const canInactivate = account.status === 'active'
                  return (
                    <Fragment key={account.user_id}>
                      <tr
                        key={account.user_id}
                        data-testid={`account-row-${account.user_id}`}
                        className="rounded-2xl bg-white shadow-sm"
                      >
                        <td className="rounded-l-2xl px-3 py-4 align-top">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-800">{displayName}</p>
                          </div>
                        </td>
                        <td className="px-3 py-4 align-top">
                          <p className="text-sm text-slate-500">{account.email}</p>
                        </td>
                        <td className="px-3 py-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            {(account.roles.length > 0 ? account.roles : ['Chưa gán vai trò']).map(
                              (role) => (
                                <span
                                  key={role}
                                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                                >
                                  {formatRoleLabel(role)}
                                </span>
                              ),
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${accountStatusTone(
                                account.status,
                              )}`}
                            >
                              {accountStatusLabel(account.status)}
                            </span>
                            {account.temporary_locked && (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                                Tạm khóa đăng nhập
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
                          {formatTimestamp(account.last_login_at)}
                        </td>
                        <td className="rounded-r-2xl px-3 py-4 align-top">
                          <div className="flex min-w-max items-center gap-2">
                            {!isSelf && (
                              <>
                                {canReactivate && (
                                  <button
                                    type="button"
                                    disabled={busyKey !== null}
                                    onClick={() =>
                                      void runAction(`active:${account.user_id}`, () =>
                                        adminApi.updateManagedAccountStatus(account.user_id, 'active'),
                                      )
                                    }
                                    data-testid={`account-activate-${account.user_id}`}
                                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <UserCheck size={14} />
                                    Kích hoạt lại
                                  </button>
                                )}
                                {canInactivate && (
                                  <button
                                    type="button"
                                    disabled={busyKey !== null}
                                    onClick={() => {
                                      const confirmed = confirmSensitiveAction(
                                        'Khóa tài khoản',
                                        `Bạn có chắc muốn khóa tài khoản “${displayName}” không?`,
                                        'Người dùng sẽ không thể tiếp tục sử dụng hệ thống cho đến khi được kích hoạt lại.',
                                      )
                                      if (!confirmed) return
                                      void runAction(`inactive:${account.user_id}`, () =>
                                        adminApi.updateManagedAccountStatus(account.user_id, 'inactive'),
                                      )
                                    }}
                                    data-testid={`account-inactivate-${account.user_id}`}
                                    className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Ban size={14} />
                                  Khóa
                                </button>
                              )}
                                <button
                                  type="button"
                                  disabled={busyKey !== null}
                                  onClick={() => {
                                    const confirmed = confirmSensitiveAction(
                                      'Thu hồi đăng nhập',
                                      `Bạn có chắc muốn thu hồi các phiên đăng nhập đang mở của “${displayName}” không?`,
                                      'Người dùng sẽ cần đăng nhập lại trên các thiết bị đang sử dụng.',
                                    )
                                    if (!confirmed) return
                                    void runAction(`revoke:${account.user_id}`, () =>
                                      adminApi.revokeManagedAccountSessions(account.user_id),
                                    )
                                  }}
                                  data-testid={`account-revoke-${account.user_id}`}
                                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <KeyRound size={14} />
                                  Thu hồi đăng nhập
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedUserId((current) =>
                                  current === account.user_id ? null : account.user_id,
                                )
                              }
                              data-testid={`account-detail-${account.user_id}`}
                              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                            >
                              {isExpanded ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                            </button>
                            {onViewChat && (
                              <button
                                type="button"
                                onClick={() => onViewChat(account.user_id)}
                                className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-100"
                              >
                                <MessageSquare size={14} />
                                Xem chat
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${account.user_id}:detail`}>
                          <td colSpan={6} className="px-0 pt-0">
                            <div className="mx-2 mb-1 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                              <div className="grid gap-4 lg:grid-cols-3">
                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                                    Hoạt động đăng nhập
                                  </p>
                                  <dl className="mt-3 space-y-2 text-sm">
                                    <div>
                                      <dt className="text-slate-500">Phiên đăng nhập đang mở</dt>
                                      <dd className="mt-1 font-semibold text-slate-800">
                                        {account.active_refresh_sessions}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-slate-500">Làm mới phiên trong 7 ngày</dt>
                                      <dd className="mt-1 font-semibold text-slate-800">
                                        {account.refreshes_7d}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-slate-500">Đăng nhập lỗi trong 7 ngày</dt>
                                      <dd className="mt-1 font-semibold text-slate-800">
                                        {account.failed_logins_7d}
                                      </dd>
                                    </div>
                                  </dl>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                                    Hoạt động gần đây
                                  </p>
                                  <dl className="mt-3 space-y-2 text-sm">
                                    <div>
                                      <dt className="text-slate-500">Số phiên trò chuyện</dt>
                                      <dd className="mt-1 font-semibold text-slate-800">
                                        {account.chat_sessions_total}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-slate-500">Tin nhắn trong 30 ngày</dt>
                                      <dd className="mt-1 font-semibold text-slate-800">
                                        {account.chat_messages_30d}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-slate-500">Lần trò chuyện gần nhất</dt>
                                      <dd className="mt-1 font-semibold text-slate-800">
                                        {formatTimestamp(account.last_chat_at)}
                                      </dd>
                                    </div>
                                  </dl>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                                    Hồ sơ và bảo mật
                                  </p>
                                  <dl className="mt-3 space-y-2 text-sm">
                                    <div>
                                      <dt className="text-slate-500">Đơn vị / phòng ban</dt>
                                      <dd className="mt-1 font-semibold text-slate-800">
                                        {account.department || 'Chưa có'}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-slate-500">Mức bảo mật</dt>
                                      <dd className="mt-1 font-semibold text-slate-800">
                                        {account.max_security_level}
                                      </dd>
                                    </div>
                                    <div>
                                      <dt className="text-slate-500">Tình trạng khóa tạm</dt>
                                      <dd className="mt-1 font-semibold text-slate-800">
                                        {account.temporary_locked ? 'Có' : 'Không'}
                                      </dd>
                                    </div>
                                  </dl>
                                </div>
                              </div>

                              <div className="mt-4">
                                <AdminTechnicalDetails description="ID nội bộ và dữ liệu chi tiết dành cho kiểm tra sâu khi cần.">
                                  <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                                    <dl className="grid gap-3 text-sm md:grid-cols-2">
                                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                        <dt className="text-slate-500">Raw ID</dt>
                                        <dd className="mt-1 font-semibold text-slate-800">
                                          {account.user_id}
                                        </dd>
                                      </div>
                                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                        <dt className="text-slate-500">Username gốc</dt>
                                        <dd className="mt-1 font-semibold text-slate-800">
                                          {account.username}
                                        </dd>
                                      </div>
                                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                        <dt className="text-slate-500">Refresh gần nhất</dt>
                                        <dd className="mt-1 font-semibold text-slate-800">
                                          {formatTimestamp(account.last_refreshed_at)}
                                        </dd>
                                      </div>
                                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                        <dt className="text-slate-500">Đăng nhập gần nhất</dt>
                                        <dd className="mt-1 font-semibold text-slate-800">
                                          {formatTimestamp(account.last_login_at)}
                                        </dd>
                                      </div>
                                    </dl>

                                    <div className="rounded-xl border border-slate-200 bg-slate-950 p-4">
                                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                                        Raw account payload
                                      </p>
                                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-100">
                                        {JSON.stringify(account, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                </AdminTechnicalDetails>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
