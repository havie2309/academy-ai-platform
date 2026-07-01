import { useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import {
  adminApi,
  type SecurityAlertEntry,
  type SecurityAlertFilters,
  type SecurityAlertStatus,
} from '../../api/admin'
import AdminTechnicalDetails from './AdminTechnicalDetails'

type AlertSeverityFilter = 'all' | SecurityAlertEntry['severity']
type AlertStatusFilter = 'all' | SecurityAlertEntry['status']

const LIMIT_OPTIONS = [25, 50, 100, 200]

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('vi-VN')
}

function severityLabel(severity: SecurityAlertEntry['severity']): string {
  switch (severity) {
    case 'low':
      return 'Thấp'
    case 'medium':
      return 'Trung bình'
    case 'high':
      return 'Cao'
    case 'critical':
      return 'Khẩn cấp'
    default:
      return severity
  }
}

function severityTone(severity: SecurityAlertEntry['severity']): string {
  switch (severity) {
    case 'low':
      return 'border-slate-200 bg-slate-50 text-slate-700'
    case 'medium':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'high':
      return 'border-orange-200 bg-orange-50 text-orange-700'
    case 'critical':
      return 'border-red-200 bg-red-50 text-red-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700'
  }
}

function statusLabel(status: SecurityAlertEntry['status']): string {
  switch (status) {
    case 'open':
      return 'Mới phát hiện'
    case 'acknowledged':
      return 'Đang theo dõi'
    case 'resolved':
      return 'Đã xử lý'
    default:
      return status
  }
}

function statusTone(status: SecurityAlertEntry['status']): string {
  switch (status) {
    case 'open':
      return 'border-red-200 bg-red-50 text-red-700'
    case 'acknowledged':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'resolved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700'
  }
}

function autoActionLabel(alert: SecurityAlertEntry): string {
  if (!alert.auto_action) return 'Chưa có'

  const actionLabels: Record<string, string> = {
    revoke_session: 'Thu hồi phiên',
    revoke_all_sessions: 'Thu hồi tất cả phiên',
    temporary_lock_account: 'Tạm khóa tài khoản',
    lock_account: 'Khóa tài khoản',
  }

  const statusLabels: Record<string, string> = {
    applied: 'đã áp dụng',
    skipped: 'bỏ qua',
    failed: 'thất bại',
  }

  const action = actionLabels[alert.auto_action] ?? alert.auto_action
  const status = statusLabels[alert.auto_action_status] ?? alert.auto_action_status
  return `${action} · ${status}`
}

function humanizeRuleCode(ruleCode: string): string {
  const labels: Record<string, string> = {
    'auth.login_failed_burst': 'Nhiều lần đăng nhập thất bại',
    'gateway.revoked_token_reuse': 'Token đã thu hồi vẫn bị dùng lại',
    'gateway.network_policy_blocked': 'Bị chặn bởi chính sách mạng',
    'gateway.rate_limit_hit': 'Gửi quá nhiều yêu cầu trong thời gian ngắn',
    'gateway.denied_burst': 'Nhiều lần bị từ chối truy cập',
    'gateway.privileged_probe': 'Thử truy cập API quản trị hoặc ETL',
  }
  return labels[ruleCode] ?? ruleCode
}

function friendlyAlertSummary(alert: SecurityAlertEntry): string {
  const labels: Record<string, string> = {
    'auth.login_failed_burst':
      'Hệ thống phát hiện nhiều lần đăng nhập thất bại liên tiếp trong thời gian ngắn.',
    'gateway.revoked_token_reuse':
      'Một token đã bị thu hồi vẫn tiếp tục được dùng để gọi hệ thống.',
    'gateway.network_policy_blocked':
      'Yêu cầu bị chặn vì không phù hợp với chính sách mạng hoặc vùng truy cập cho phép.',
    'gateway.rate_limit_hit':
      'Một nguồn đang gửi quá nhiều yêu cầu trong thời gian ngắn.',
    'gateway.denied_burst':
      'Cùng một người dùng hoặc địa chỉ IP liên tục bị từ chối truy cập.',
    'gateway.privileged_probe':
      'Có dấu hiệu thử truy cập API quản trị hoặc ETL không đúng quyền.',
  }

  return labels[alert.rule_code] ?? alert.summary
}

function resourceTypeLabel(value: string | null | undefined): string {
  if (!value) return 'Chưa xác định'

  const labels: Record<string, string> = {
    gateway: 'API Gateway',
    etl: 'ETL Sync',
    rag: 'RAG Engine',
    audit: 'Nhật ký kiểm toán',
    auth: 'Xác thực',
    user: 'Người dùng',
  }

  return labels[value] ?? value
}

function prettifyValue(value: unknown): string {
  if (value == null) return 'Không có'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export default function AdminSecurityAlertsSection() {
  const [alerts, setAlerts] = useState<SecurityAlertEntry[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlertEntry | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState<SecurityAlertStatus | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [severityFilter, setSeverityFilter] = useState<AlertSeverityFilter>('all')
  const [statusFilter, setStatusFilter] = useState<AlertStatusFilter>('all')
  const [ruleCodeFilter, setRuleCodeFilter] = useState('')
  const [userIdFilter, setUserIdFilter] = useState('')
  const [resourceTypeFilter, setResourceTypeFilter] = useState('')
  const [limitFilter, setLimitFilter] = useState<number>(50)

  const buildFilters = (): SecurityAlertFilters => ({
    severity: severityFilter === 'all' ? undefined : severityFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    ruleCode: ruleCodeFilter.trim() || undefined,
    userId: userIdFilter.trim() || undefined,
    resourceType: resourceTypeFilter.trim() || undefined,
    limit: limitFilter,
  })

  const resolveSelected = (
    nextAlerts: SecurityAlertEntry[],
    preferredId?: number | null,
  ) => {
    const candidate = preferredId === undefined ? selectedId : preferredId
    if (candidate != null) {
      const matched = nextAlerts.find((entry) => entry.id === candidate) ?? null
      if (matched) return matched
    }
    return nextAlerts[0] ?? null
  }

  const loadAlerts = async (preferredId?: number | null) => {
    setLoading(true)
    try {
      const nextAlerts = await adminApi.getSecurityAlerts(buildFilters())
      setAlerts(nextAlerts)
      const nextSelected = resolveSelected(nextAlerts, preferredId)
      setSelectedId(nextSelected?.id ?? null)
      setSelectedAlert(nextSelected)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAlerts().catch((nextError) => {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Không tải được cảnh báo bảo mật.',
      )
    })
  }, [])

  const applyFilters = async () => {
    setError(null)
    setMessage(null)
    try {
      await loadAlerts()
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Không lọc được cảnh báo bảo mật.',
      )
    }
  }

  const resetFilters = async () => {
    setSeverityFilter('all')
    setStatusFilter('all')
    setRuleCodeFilter('')
    setUserIdFilter('')
    setResourceTypeFilter('')
    setLimitFilter(50)
    setError(null)
    setMessage(null)
    try {
      const nextAlerts = await adminApi.getSecurityAlerts({ limit: 50 })
      setAlerts(nextAlerts)
      const nextSelected = nextAlerts[0] ?? null
      setSelectedId(nextSelected?.id ?? null)
      setSelectedAlert(nextSelected)
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Không tải lại được cảnh báo bảo mật.',
      )
    }
  }

  const refreshAlerts = async () => {
    setError(null)
    setMessage(null)
    try {
      await loadAlerts()
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Không tải lại được cảnh báo bảo mật.',
      )
    }
  }

  const updateStatus = async (status: SecurityAlertStatus) => {
    if (!selectedAlert) return
    setUpdatingStatus(status)
    setError(null)
    setMessage(null)
    try {
      const updated = await adminApi.updateSecurityAlertStatus(selectedAlert.id, status)
      setAlerts((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      )
      setSelectedId(updated.id)
      setSelectedAlert(updated)
      setMessage(
        `Đã cập nhật cảnh báo #${updated.id} sang trạng thái ${statusLabel(status)}.`,
      )
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Không cập nhật được trạng thái cảnh báo.',
      )
    } finally {
      setUpdatingStatus(null)
    }
  }

  const openCount = alerts.filter((alert) => alert.status === 'open').length
  const escalatedCount = alerts.filter(
    (alert) => alert.severity === 'high' || alert.severity === 'critical',
  ).length
  const autoActionCount = alerts.filter(
    (alert) => alert.auto_action_status === 'applied',
  ).length
  const latestSeen = alerts[0]?.last_seen_at ?? null

  return (
    <section
      className="mt-6 rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm"
      data-testid="admin-security-alerts-section"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <ShieldAlert className="text-red-600" size={18} />
            Cảnh báo bảo mật
          </h2>
        </div>

        <button
          type="button"
          onClick={() => void refreshAlerts()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white"
        >
          <RefreshCw size={15} />
          Tải lại cảnh báo
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
              <CheckCircle2 className="mt-0.5 shrink-0" size={16} />
              <span>{message}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Đang hiển thị
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{loading ? '...' : alerts.length}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Cần theo dõi
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {loading ? '...' : openCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Mức cao / khẩn
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {loading ? '...' : escalatedCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Đã tự xử lý
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {loading ? '...' : autoActionCount}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {loading ? '...' : formatTimestamp(latestSeen)}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
        <div className="grid gap-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Mức độ
            </label>
            <select
              value={severityFilter}
              onChange={(event) =>
                setSeverityFilter(event.target.value as AlertSeverityFilter)
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            >
              <option value="all">Tất cả mức độ</option>
              <option value="low">Thấp</option>
              <option value="medium">Trung bình</option>
              <option value="high">Cao</option>
              <option value="critical">Khẩn cấp</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Trạng thái
            </label>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as AlertStatusFilter)
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="open">Mới phát hiện</option>
              <option value="acknowledged">Đang theo dõi</option>
              <option value="resolved">Đã xử lý</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Loại cảnh báo
            </label>
            <input
              value={ruleCodeFilter}
              onChange={(event) => setRuleCodeFilter(event.target.value)}
              placeholder="Ví dụ: truy cập API quản trị"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Mã người dùng
            </label>
            <input
              value={userIdFilter}
              onChange={(event) => setUserIdFilter(event.target.value)}
              placeholder="Ví dụ: USR001"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Dịch vụ
            </label>
            <input
              value={resourceTypeFilter}
              onChange={(event) => setResourceTypeFilter(event.target.value)}
              placeholder="Ví dụ: etl, gateway"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
                Số dòng
              </label>
              <select
                value={String(limitFilter)}
                onChange={(event) => setLimitFilter(Number(event.target.value))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              >
                {LIMIT_OPTIONS.map((limit) => (
                  <option key={limit} value={String(limit)}>
                    {limit}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void applyFilters()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Áp dụng
            </button>
            <button
              type="button"
              onClick={() => void resetFilters()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Đặt lại
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-50/70">
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 p-3">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-3">Mức độ</th>
                  <th className="px-3">Cảnh báo</th>
                  <th className="px-3">Người dùng / IP</th>
                  <th className="px-3">Trạng thái</th>
                  <th className="px-3">Số lần ghi nhận</th>
                  <th className="px-3">Lần gần nhất</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="rounded-2xl bg-white px-4 py-6 text-sm text-slate-500"
                    >
                      Đang tải cảnh báo bảo mật...
                    </td>
                  </tr>
                )}

                {!loading && alerts.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="rounded-2xl bg-white px-4 py-6 text-sm text-slate-500"
                    >
                      Không có cảnh báo nào khớp với bộ lọc hiện tại.
                    </td>
                  </tr>
                )}

                {!loading &&
                  alerts.map((alert) => {
                    const isSelected = selectedId === alert.id
                    return (
                      <tr
                        key={alert.id}
                        className={`cursor-pointer rounded-2xl bg-white shadow-sm transition ${
                          isSelected
                            ? 'ring-2 ring-blue-200'
                            : 'hover:ring-1 hover:ring-slate-200'
                        }`}
                        onClick={() => {
                          setSelectedId(alert.id)
                          setSelectedAlert(alert)
                          setMessage(null)
                        }}
                      >
                        <td className="rounded-l-2xl px-3 py-4 align-top">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-semibold leading-none tracking-normal ${severityTone(
                              alert.severity,
                            )}`}
                          >
                            {severityLabel(alert.severity)}
                          </span>
                        </td>
                        <td className="px-3 py-4 align-top">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-800">
                              {humanizeRuleCode(alert.rule_code)}
                            </p>
                            <p className="text-sm text-slate-500">
                              {friendlyAlertSummary(alert)}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-4 align-top text-sm text-slate-600">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-800">
                              {alert.user_id ?? 'Chưa xác định'}
                            </p>
                            <p className="font-mono text-xs text-slate-500">
                              {alert.ip_address ?? 'Chưa có IP'}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-4 align-top">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-semibold leading-none tracking-normal ${statusTone(
                              alert.status,
                            )}`}
                          >
                            {statusLabel(alert.status)}
                          </span>
                        </td>
                        <td className="px-3 py-4 align-top text-sm font-semibold text-slate-800">
                          {alert.event_count}
                        </td>
                        <td className="rounded-r-2xl px-3 py-4 align-top text-sm text-slate-600">
                          {formatTimestamp(alert.last_seen_at)}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>

        <aside
          className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4"
          data-testid="security-alert-detail-panel"
        >
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Eye className="text-blue-600" size={16} />
            Chi tiết cảnh báo
          </h3>

          {!selectedAlert && (
            <p className="mt-4 text-sm text-slate-500">
              Chọn một cảnh báo ở bên trái để xem nguyên nhân, ai bị ảnh hưởng và
              hệ thống đã xử lý gì.
            </p>
          )}

          {selectedAlert && (
            <div className="mt-4 space-y-4">
              <dl className="grid gap-3 text-sm">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-slate-500">Loại cảnh báo / mức độ</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {humanizeRuleCode(selectedAlert.rule_code)} ·{' '}
                    {severityLabel(selectedAlert.severity)}
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-slate-500">Trạng thái / số lần ghi nhận</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {statusLabel(selectedAlert.status)} · {selectedAlert.event_count} lần
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-slate-500">Người dùng / phiên / IP</dt>
                  <dd className="mt-1 text-slate-800">
                    {selectedAlert.user_id ?? 'Chưa xác định'}
                    {selectedAlert.session_id
                      ? ` · phiên ${selectedAlert.session_id}`
                      : ''}
                    {selectedAlert.ip_address ? ` · ${selectedAlert.ip_address}` : ''}
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-slate-500">Hệ thống tự xử lý</dt>
                  <dd className="mt-1 text-slate-800">
                    {autoActionLabel(selectedAlert)}
                    {selectedAlert.auto_action_note ? (
                      <span className="block pt-1 text-sm text-slate-500">
                        {selectedAlert.auto_action_note}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-slate-500">Tóm tắt dễ hiểu</dt>
                  <dd className="mt-1 text-slate-800">
                    {friendlyAlertSummary(selectedAlert)}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2">
                {selectedAlert.status !== 'acknowledged' &&
                  selectedAlert.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={() => void updateStatus('acknowledged')}
                      disabled={updatingStatus !== null}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {updatingStatus === 'acknowledged'
                        ? 'Đang cập nhật...'
                        : 'Đánh dấu đang theo dõi'}
                    </button>
                  )}
                {selectedAlert.status !== 'resolved' && (
                  <button
                    type="button"
                    onClick={() => void updateStatus('resolved')}
                    disabled={updatingStatus !== null}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {updatingStatus === 'resolved'
                      ? 'Đang cập nhật...'
                      : 'Đánh dấu đã xử lý'}
                  </button>
                )}
                {selectedAlert.status !== 'open' && (
                  <button
                    type="button"
                    onClick={() => void updateStatus('open')}
                    disabled={updatingStatus !== null}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updatingStatus === 'open'
                      ? 'Đang cập nhật...'
                      : 'Mở lại cảnh báo'}
                  </button>
                )}
              </div>

              <AdminTechnicalDetails
                testId="security-alert-technical"
                description="Bao gồm mã quy tắc gốc, đường dẫn gọi API, tài nguyên bị tác động và dữ liệu JSON phục vụ kiểm tra sâu."
              >
                <div className="space-y-4">
                  <dl className="grid gap-3 text-sm md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <dt className="text-slate-500">Mã quy tắc gốc</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {selectedAlert.rule_code}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <dt className="text-slate-500">Dấu vân tay sự cố</dt>
                      <dd className="mt-1 font-mono text-xs font-semibold text-slate-800">
                        {selectedAlert.fingerprint}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <dt className="text-slate-500">Phương thức / đường dẫn</dt>
                      <dd className="mt-1 text-slate-800">
                        {selectedAlert.http_method ?? 'N/A'} ·{' '}
                        <span className="font-mono text-xs">
                          {selectedAlert.http_path ?? 'N/A'}
                        </span>
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <dt className="text-slate-500">Dịch vụ / tài nguyên</dt>
                      <dd className="mt-1 text-slate-800">
                        {resourceTypeLabel(selectedAlert.resource_type)}
                        {selectedAlert.resource_id
                          ? ` · ${selectedAlert.resource_id}`
                          : ''}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <dt className="text-slate-500">Lần đầu / lần gần nhất</dt>
                      <dd className="mt-1 text-slate-800">
                        {formatTimestamp(selectedAlert.first_seen_at)} ·{' '}
                        {formatTimestamp(selectedAlert.last_seen_at)}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <dt className="text-slate-500">Người xác nhận / người xử lý</dt>
                      <dd className="mt-1 text-slate-800">
                        {selectedAlert.acknowledged_by ?? 'N/A'} ·{' '}
                        {selectedAlert.resolved_by ?? 'N/A'}
                      </dd>
                    </div>
                  </dl>

                  <div className="rounded-xl border border-slate-200 bg-slate-950 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Dữ liệu kỹ thuật
                    </p>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-100">
                      {prettifyValue(selectedAlert.payload)}
                    </pre>
                  </div>
                </div>
              </AdminTechnicalDetails>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
