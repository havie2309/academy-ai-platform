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
  if (!value) return 'Chua co'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('vi-VN')
}

function severityLabel(severity: SecurityAlertEntry['severity']): string {
  switch (severity) {
    case 'low':
      return 'Low'
    case 'medium':
      return 'Medium'
    case 'high':
      return 'High'
    case 'critical':
      return 'Critical'
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
      return 'Open'
    case 'acknowledged':
      return 'Acknowledged'
    case 'resolved':
      return 'Resolved'
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
  if (!alert.auto_action) return 'Chua co'
  const action = alert.auto_action
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
  return `${action} / ${alert.auto_action_status}`
}

function humanizeRuleCode(ruleCode: string): string {
  const labels: Record<string, string> = {
    'auth.login_failed_burst': 'Nhieu lan dang nhap that bai',
    'gateway.revoked_token_reuse': 'Token da revoke van bi dung lai',
    'gateway.network_policy_blocked': 'Bi chan boi network policy',
    'gateway.rate_limit_hit': 'Hit rate limit tai gateway',
    'gateway.denied_burst': 'Nhieu lan 401/403 tu cung user/IP',
    'gateway.privileged_probe': 'User thuong co goi endpoint admin/ETL',
  }
  return labels[ruleCode] ?? ruleCode
}

function prettifyValue(value: unknown): string {
  if (value == null) return 'Khong co'
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
          : 'Khong tai duoc security alerts.',
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
          : 'Khong loc duoc security alerts.',
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
          : 'Khong tai lai duoc security alerts.',
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
          : 'Khong tai lai duoc security alerts.',
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
      setMessage(`Da cap nhat alert #${updated.id} sang trang thai ${statusLabel(status)}.`)
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Khong cap nhat duoc trang thai security alert.',
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
            Security Alerts
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Tach rieng cac hanh vi dang ngo khoi audit log tho de admin theo doi,
            acknowledge va resolve nhanh hon.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshAlerts()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white"
        >
          <RefreshCw size={15} />
          Tai lai alerts
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
            Alert dang hien thi
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{loading ? '...' : alerts.length}</p>
          <p className="mt-2 text-sm text-slate-500">
            Danh sach da ap dung bo loc hien tai.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Dang mo
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {loading ? '...' : openCount}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Cac alert chua duoc acknowledge hoac resolve.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            High / Critical
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {loading ? '...' : escalatedCount}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Nhung alert can admin review uu tien.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Auto action da ap dung
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {loading ? '...' : autoActionCount}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Cap nhat moi nhat {loading ? '...' : formatTimestamp(latestSeen)}.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
        <div className="grid gap-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Severity
            </label>
            <select
              value={severityFilter}
              onChange={(event) =>
                setSeverityFilter(event.target.value as AlertSeverityFilter)
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            >
              <option value="all">Tat ca severity</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as AlertStatusFilter)
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            >
              <option value="all">Tat ca status</option>
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Rule code
            </label>
            <input
              value={ruleCodeFilter}
              onChange={(event) => setRuleCodeFilter(event.target.value)}
              placeholder="Vi du: gateway.denied_burst"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              User ID
            </label>
            <input
              value={userIdFilter}
              onChange={(event) => setUserIdFilter(event.target.value)}
              placeholder="Vi du: USR001"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Resource type
            </label>
            <input
              value={resourceTypeFilter}
              onChange={(event) => setResourceTypeFilter(event.target.value)}
              placeholder="Vi du: etl, gateway"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
                So dong
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
              Ap dung
            </button>
            <button
              type="button"
              onClick={() => void resetFilters()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Dat lai
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
                  <th className="px-3">Severity</th>
                  <th className="px-3">Alert</th>
                  <th className="px-3">User / IP</th>
                  <th className="px-3">Status</th>
                  <th className="px-3">Event count</th>
                  <th className="px-3">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="rounded-2xl bg-white px-4 py-6 text-sm text-slate-500"
                    >
                      Dang tai security alerts...
                    </td>
                  </tr>
                )}

                {!loading && alerts.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="rounded-2xl bg-white px-4 py-6 text-sm text-slate-500"
                    >
                      Khong co alert nao khop bo loc hien tai.
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
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${severityTone(
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
                            <p className="text-sm text-slate-500">{alert.summary}</p>
                          </div>
                        </td>
                        <td className="px-3 py-4 align-top text-sm text-slate-600">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-800">
                              {alert.user_id ?? 'Anonymous'}
                            </p>
                            <p className="font-mono text-xs text-slate-500">
                              {alert.ip_address ?? 'Khong co IP'}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-4 align-top">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusTone(
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
            Chi tiet security alert
          </h3>

          {!selectedAlert && (
            <p className="mt-4 text-sm text-slate-500">
              Chon mot alert o ben trai de xem noi dung, auto action va payload ky
              thuat.
            </p>
          )}

          {selectedAlert && (
            <div className="mt-4 space-y-4">
              <dl className="grid gap-3 text-sm">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-slate-500">Rule / severity</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {humanizeRuleCode(selectedAlert.rule_code)} ·{' '}
                    {severityLabel(selectedAlert.severity)}
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-slate-500">Trang thai / event count</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {statusLabel(selectedAlert.status)} · {selectedAlert.event_count} lan
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-slate-500">User / session / IP</dt>
                  <dd className="mt-1 text-slate-800">
                    {selectedAlert.user_id ?? 'Anonymous'}
                    {selectedAlert.session_id
                      ? ` · session ${selectedAlert.session_id}`
                      : ''}
                    {selectedAlert.ip_address ? ` · ${selectedAlert.ip_address}` : ''}
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-slate-500">Auto action</dt>
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
                  <dt className="text-slate-500">Tom tat</dt>
                  <dd className="mt-1 text-slate-800">{selectedAlert.summary}</dd>
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
                        ? 'Dang acknowledge...'
                        : 'Acknowledge'}
                    </button>
                  )}
                {selectedAlert.status !== 'resolved' && (
                  <button
                    type="button"
                    onClick={() => void updateStatus('resolved')}
                    disabled={updatingStatus !== null}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {updatingStatus === 'resolved' ? 'Dang resolve...' : 'Resolve'}
                  </button>
                )}
                {selectedAlert.status !== 'open' && (
                  <button
                    type="button"
                    onClick={() => void updateStatus('open')}
                    disabled={updatingStatus !== null}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updatingStatus === 'open' ? 'Dang reopen...' : 'Reopen'}
                  </button>
                )}
              </div>

              <AdminTechnicalDetails
                testId="security-alert-technical"
                description="Bao gom rule code goc, path/method, resource, actor acknowledge/resolve va payload JSON phuc vu dieu tra sau su co."
              >
                <div className="space-y-4">
                  <dl className="grid gap-3 text-sm md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <dt className="text-slate-500">Rule code</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {selectedAlert.rule_code}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <dt className="text-slate-500">Fingerprint</dt>
                      <dd className="mt-1 font-mono text-xs font-semibold text-slate-800">
                        {selectedAlert.fingerprint}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <dt className="text-slate-500">HTTP method / path</dt>
                      <dd className="mt-1 text-slate-800">
                        {selectedAlert.http_method ?? 'N/A'} ·{' '}
                        <span className="font-mono text-xs">
                          {selectedAlert.http_path ?? 'N/A'}
                        </span>
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <dt className="text-slate-500">Resource</dt>
                      <dd className="mt-1 text-slate-800">
                        {selectedAlert.resource_type ?? 'N/A'}
                        {selectedAlert.resource_id
                          ? ` · ${selectedAlert.resource_id}`
                          : ''}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <dt className="text-slate-500">First / last seen</dt>
                      <dd className="mt-1 text-slate-800">
                        {formatTimestamp(selectedAlert.first_seen_at)} ·{' '}
                        {formatTimestamp(selectedAlert.last_seen_at)}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <dt className="text-slate-500">Ack / resolved by</dt>
                      <dd className="mt-1 text-slate-800">
                        {selectedAlert.acknowledged_by ?? 'N/A'} ·{' '}
                        {selectedAlert.resolved_by ?? 'N/A'}
                      </dd>
                    </div>
                  </dl>

                  <div className="rounded-xl border border-slate-200 bg-slate-950 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Payload
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
