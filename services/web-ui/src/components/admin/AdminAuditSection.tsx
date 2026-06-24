import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Download,
  Eye,
  FileJson,
  Filter,
  History,
  RefreshCw,
  Search,
} from 'lucide-react'
import {
  adminApi,
  type AuditLogEntry,
  type AuditLogFilters,
} from '../../api/admin'

type AuditStatusFilter = 'all' | AuditLogEntry['status']

const LIMIT_OPTIONS = [25, 50, 100, 200]

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Chua co'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('vi-VN')
}

function statusLabel(status: AuditLogEntry['status']): string {
  switch (status) {
    case 'success':
      return 'Thanh cong'
    case 'failure':
      return 'That bai'
    case 'denied':
      return 'Bi chan'
    default:
      return status
  }
}

function statusTone(status: AuditLogEntry['status']): string {
  switch (status) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'failure':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'denied':
      return 'border-red-200 bg-red-50 text-red-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600'
  }
}

function toIsoOrUndefined(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

function stringifyValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
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

function toCsv(logs: AuditLogEntry[]): string {
  const headers = [
    'id',
    'created_at',
    'status',
    'action',
    'user_id',
    'resource_type',
    'resource_id',
    'reason',
    'ip_address',
    'user_agent',
    'old_value',
    'new_value',
  ]

  const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`

  const rows = logs.map((log) =>
    [
      String(log.id),
      log.created_at,
      log.status,
      log.action,
      log.user_id ?? '',
      log.resource_type ?? '',
      log.resource_id ?? '',
      log.reason ?? '',
      log.ip_address ?? '',
      log.user_agent ?? '',
      stringifyValue(log.old_value),
      stringifyValue(log.new_value),
    ]
      .map((value) => escapeCell(value))
      .join(','),
  )

  return [headers.join(','), ...rows].join('\n')
}

function triggerDownload(contents: string, filename: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function AdminAuditSection() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<AuditStatusFilter>('all')
  const [actionFilter, setActionFilter] = useState('')
  const [resourceTypeFilter, setResourceTypeFilter] = useState('')
  const [userIdFilter, setUserIdFilter] = useState('')
  const [resourceIdFilter, setResourceIdFilter] = useState('')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')
  const [limitFilter, setLimitFilter] = useState<number>(50)

  const buildFilters = (overrideLimit?: number): AuditLogFilters => ({
    status: statusFilter === 'all' ? undefined : statusFilter,
    action: actionFilter.trim() || undefined,
    resourceType: resourceTypeFilter.trim() || undefined,
    userId: userIdFilter.trim() || undefined,
    resourceId: resourceIdFilter.trim() || undefined,
    from: toIsoOrUndefined(fromFilter),
    to: toIsoOrUndefined(toFilter),
    limit: overrideLimit ?? limitFilter,
  })

  const resolveSelectedId = (
    nextLogs: AuditLogEntry[],
    preferredId?: number | null,
  ): number | null => {
    const candidate = preferredId === undefined ? selectedId : preferredId
    if (candidate != null && nextLogs.some((entry) => entry.id === candidate)) {
      return candidate
    }
    return nextLogs[0]?.id ?? null
  }

  const hydrateDetail = async (id: number | null) => {
    if (id == null) {
      setSelectedId(null)
      setSelectedLog(null)
      return
    }

    setDetailLoading(true)
    try {
      const detail = await adminApi.getAuditLog(id)
      setSelectedId(id)
      setSelectedLog(detail)
    } finally {
      setDetailLoading(false)
    }
  }

  const loadLogs = async (
    filters: AuditLogFilters = buildFilters(),
    preferredId?: number | null,
  ) => {
    setLoading(true)
    try {
      const nextLogs = await adminApi.getAuditLogs(filters)
      setLogs(nextLogs)
      await hydrateDetail(resolveSelectedId(nextLogs, preferredId))
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (id: number) => {
    setError(null)
    setMessage(null)
    await hydrateDetail(id)
  }

  useEffect(() => {
    void loadLogs().catch((nextError) => {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Khong tai duoc audit log.',
      )
    })
  }, [])

  const applyFilters = async () => {
    setError(null)
    setMessage(null)
    try {
      await loadLogs(buildFilters())
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Khong loc duoc audit log.',
      )
    }
  }

  const resetFilters = async () => {
    setStatusFilter('all')
    setActionFilter('')
    setResourceTypeFilter('')
    setUserIdFilter('')
    setResourceIdFilter('')
    setFromFilter('')
    setToFilter('')
    setLimitFilter(50)
    setError(null)
    setMessage(null)
    try {
      await loadLogs({ limit: 50 }, null)
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Khong tai lai duoc audit log.',
      )
    }
  }

  const exportLogs = async (format: 'json' | 'csv') => {
    setExporting(format)
    setError(null)
    setMessage(null)
    try {
      const exportRows = await adminApi.getAuditLogs(buildFilters(500))
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      if (format === 'json') {
        triggerDownload(
          JSON.stringify(exportRows, null, 2),
          `audit-log-${stamp}.json`,
          'application/json',
        )
      } else {
        triggerDownload(
          toCsv(exportRows),
          `audit-log-${stamp}.csv`,
          'text/csv;charset=utf-8',
        )
      }
      setMessage(
        `Da xuat ${exportRows.length} dong audit theo bo loc hien tai (${format.toUpperCase()}).`,
      )
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Khong xuat duoc audit log.',
      )
    } finally {
      setExporting(null)
    }
  }

  return (
    <section
      className="mt-6 rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm"
      data-testid="admin-audit-section"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <History className="text-blue-600" size={18} />
            Audit viewer va export
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Loc su kien audit, mo chi tiet thay doi va xuat du lieu theo bo loc
            hien tai. Export gioi han toi da 500 dong moi lan.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void loadLogs(buildFilters()).catch((nextError) => {
                setError(
                  nextError instanceof Error
                    ? nextError.message
                    : 'Khong tai lai duoc audit log.',
                )
              })
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white"
          >
            <RefreshCw size={15} />
            Lam moi audit
          </button>
          <button
            type="button"
            onClick={() => void exportLogs('json')}
            disabled={exporting !== null}
            data-testid="audit-export-json"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileJson size={15} />
            {exporting === 'json' ? 'Dang xuat JSON...' : 'Xuat JSON'}
          </button>
          <button
            type="button"
            onClick={() => void exportLogs('csv')}
            disabled={exporting !== null}
            data-testid="audit-export-csv"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Download size={15} />
            {exporting === 'csv' ? 'Dang xuat CSV...' : 'Xuat CSV'}
          </button>
        </div>
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
              <Download className="mt-0.5 shrink-0" size={16} />
              <span>{message}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="min-w-[180px] flex-1">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Trang thai
            </label>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as AuditStatusFilter)
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            >
              <option value="all">Moi trang thai</option>
              <option value="success">Thanh cong</option>
              <option value="failure">That bai</option>
              <option value="denied">Bi chan</option>
            </select>
          </div>

          <div className="min-w-[180px] flex-1">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Action
            </label>
            <input
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              placeholder="login, update, delete..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <div className="min-w-[180px] flex-1">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Resource type
            </label>
            <input
              value={resourceTypeFilter}
              onChange={(event) => setResourceTypeFilter(event.target.value)}
              placeholder="auth, admin_config, document..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <div className="min-w-[180px] flex-1">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              User ID
            </label>
            <input
              value={userIdFilter}
              onChange={(event) => setUserIdFilter(event.target.value)}
              placeholder="admin"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <div className="min-w-[180px] flex-1">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Resource ID
            </label>
            <input
              value={resourceIdFilter}
              onChange={(event) => setResourceIdFilter(event.target.value)}
              placeholder="rag-policy, DOC-001..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <div className="min-w-[190px]">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Tu thoi diem
            </label>
            <input
              type="datetime-local"
              value={fromFilter}
              onChange={(event) => setFromFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <div className="min-w-[190px]">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Den thoi diem
            </label>
            <input
              type="datetime-local"
              value={toFilter}
              onChange={(event) => setToFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <div className="min-w-[120px]">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              So dong
            </label>
            <select
              value={String(limitFilter)}
              onChange={(event) => setLimitFilter(Number(event.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            >
              {LIMIT_OPTIONS.map((limit) => (
                <option key={limit} value={String(limit)}>
                  {limit}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void applyFilters()}
              data-testid="audit-apply"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Filter size={15} />
              Ap dung
            </button>
            <button
              type="button"
              onClick={() => void resetFilters()}
              data-testid="audit-reset"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              <Search size={15} />
              Dat lai
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-50/70">
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 p-3">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-3">Su kien</th>
                  <th className="px-3">Tac nhan</th>
                  <th className="px-3">Trang thai</th>
                  <th className="px-3">Thoi gian</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={4}
                      className="rounded-2xl bg-white px-4 py-6 text-sm text-slate-500"
                    >
                      Dang tai audit log...
                    </td>
                  </tr>
                )}

                {!loading && logs.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="rounded-2xl bg-white px-4 py-6 text-sm text-slate-500"
                    >
                      Khong co ban ghi audit nao khop bo loc hien tai.
                    </td>
                  </tr>
                )}

                {!loading &&
                  logs.map((log) => {
                    const isSelected = selectedId === log.id
                    return (
                      <tr
                        key={log.id}
                        data-testid={`audit-row-${log.id}`}
                        className={`cursor-pointer rounded-2xl bg-white shadow-sm transition ${
                          isSelected
                            ? 'ring-2 ring-blue-200'
                            : 'hover:ring-1 hover:ring-slate-200'
                        }`}
                        onClick={() => {
                          void loadDetail(log.id).catch((nextError) => {
                            setError(
                              nextError instanceof Error
                                ? nextError.message
                                : 'Khong tai duoc chi tiet audit log.',
                            )
                          })
                        }}
                      >
                        <td className="rounded-l-2xl px-3 py-4 align-top">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-800">{log.action}</p>
                            <p className="text-xs text-slate-500">
                              {log.resource_type ?? 'Khong co resource type'}
                              {log.resource_id ? ` | ${log.resource_id}` : ''}
                            </p>
                            {log.reason && (
                              <p className="text-xs text-slate-400">{log.reason}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-4 align-top text-sm text-slate-600">
                          <p className="font-semibold text-slate-800">
                            {log.user_id ?? 'System'}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {log.ip_address ?? 'Khong co IP'}
                          </p>
                        </td>
                        <td className="px-3 py-4 align-top">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusTone(
                              log.status,
                            )}`}
                          >
                            {statusLabel(log.status)}
                          </span>
                        </td>
                        <td className="rounded-r-2xl px-3 py-4 align-top text-sm text-slate-600">
                          {formatTimestamp(log.created_at)}
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
          data-testid="audit-detail-panel"
        >
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Eye className="text-blue-600" size={16} />
            Chi tiet ban ghi audit
          </h3>

          {detailLoading && (
            <p className="mt-4 text-sm text-slate-500">Dang tai chi tiet...</p>
          )}

          {!detailLoading && !selectedLog && (
            <p className="mt-4 text-sm text-slate-500">
              Chon mot dong audit ben trai de xem payload cu/moi va metadata day
              du.
            </p>
          )}

          {!detailLoading && selectedLog && (
            <div className="mt-4 space-y-4">
              <dl className="grid gap-3 text-sm">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-slate-500">ID / action</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    #{selectedLog.id} | {selectedLog.action}
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-slate-500">Tac nhan / trang thai</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {selectedLog.user_id ?? 'System'} |{' '}
                    {statusLabel(selectedLog.status)}
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-slate-500">Resource</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {selectedLog.resource_type ?? 'Khong co'}
                    {selectedLog.resource_id ? ` | ${selectedLog.resource_id}` : ''}
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-slate-500">Thoi gian / IP</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {formatTimestamp(selectedLog.created_at)}
                  </dd>
                  <dd className="mt-1 text-xs text-slate-500">
                    {selectedLog.ip_address ?? 'Khong co IP'} |{' '}
                    {selectedLog.user_agent ?? 'Khong co user agent'}
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-slate-500">Ly do</dt>
                  <dd className="mt-1 text-slate-700">
                    {selectedLog.reason ?? 'Khong co'}
                  </dd>
                </div>
              </dl>

              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-950 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    old_value
                  </p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-100">
                    {prettifyValue(selectedLog.old_value)}
                  </pre>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-950 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    new_value
                  </p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-100">
                    {prettifyValue(selectedLog.new_value)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
