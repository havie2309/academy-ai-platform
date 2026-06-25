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
import AdminTechnicalDetails from './AdminTechnicalDetails'

type AuditStatusFilter = 'all' | AuditLogEntry['status']

const LIMIT_OPTIONS = [25, 50, 100, 200]

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('vi-VN')
}

function statusLabel(status: AuditLogEntry['status']): string {
  switch (status) {
    case 'success':
      return 'Thành công'
    case 'failure':
      return 'Thất bại'
    case 'denied':
      return 'Bị chặn'
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

function humanizeAction(action: string): string {
  const knownLabels: Record<string, string> = {
    'policy.update': 'Cập nhật chính sách AI',
    'account.lock': 'Khóa tài khoản',
    'account.unlock': 'Mở khóa tài khoản',
    'account.activate': 'Kích hoạt tài khoản',
    'account.inactivate': 'Tạm ngưng tài khoản',
    'session.revoke': 'Thu hồi đăng nhập',
    'auth.login': 'Đăng nhập',
    'auth.logout': 'Đăng xuất',
  }

  if (knownLabels[action]) return knownLabels[action]

  if (action.includes('policy')) return 'Cập nhật chính sách'
  if (action.includes('account')) return 'Cập nhật tài khoản'
  if (action.includes('auth')) return 'Hoạt động đăng nhập'

  return action
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ')
}

function humanizeResourceType(resourceType: string | null): string {
  if (!resourceType) return 'Chưa xác định'

  const knownLabels: Record<string, string> = {
    admin_config: 'Chính sách AI',
    auth: 'Đăng nhập và phiên',
    user: 'Tài khoản người dùng',
    audit: 'Nhật ký kiểm toán',
    document: 'Tài liệu',
    rag: 'Trợ lý AI tra cứu',
    gateway: 'Kết nối dịch vụ',
  }

  return knownLabels[resourceType] ?? resourceType
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
  if (value == null) return 'Không có'
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
          : 'Không tải được nhật ký kiểm toán.',
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
          : 'Không lọc được nhật ký kiểm toán.',
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
          : 'Không tải lại được nhật ký kiểm toán.',
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
        `Đã xuất ${exportRows.length} bản ghi nhật ký theo bộ lọc hiện tại (${format.toUpperCase()}).`,
      )
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Không xuất được nhật ký kiểm toán.',
      )
    } finally {
      setExporting(null)
    }
  }

  const successCount = logs.filter((log) => log.status === 'success').length
  const reviewCount = logs.filter((log) => log.status !== 'success').length
  const latestLog = logs[0] ?? null

  return (
    <section
      className="mt-6 rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm"
      data-testid="admin-audit-section"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <History className="text-blue-600" size={18} />
            Hoạt động kiểm toán gần đây
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi các thay đổi quản trị, xem nhanh ai đã thao tác và chỉ mở chi tiết kỹ
            thuật khi cần kiểm tra sâu hơn.
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
                    : 'Không tải lại được nhật ký kiểm toán.',
                )
              })
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white"
          >
            <RefreshCw size={15} />
            Tải lại nhật ký
          </button>
          <button
            type="button"
            onClick={() => void exportLogs('json')}
            disabled={exporting !== null}
            data-testid="audit-export-json"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileJson size={15} />
            {exporting === 'json' ? 'Đang xuất JSON...' : 'Xuất nhật ký JSON'}
          </button>
          <button
            type="button"
            onClick={() => void exportLogs('csv')}
            disabled={exporting !== null}
            data-testid="audit-export-csv"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Download size={15} />
            {exporting === 'csv' ? 'Đang xuất CSV...' : 'Xuất nhật ký CSV'}
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

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Bản ghi đang hiển thị
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{loading ? '...' : logs.length}</p>
          <p className="mt-2 text-sm text-slate-500">
            Bộ lọc hiện tại đang áp dụng cho danh sách bên dưới.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Kết quả thành công
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {loading ? '...' : successCount}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Những thay đổi đã hoàn tất đúng như mong đợi.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Cần xem lại
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {loading ? '...' : reviewCount}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Bao gồm bản ghi bị chặn hoặc thất bại cần kiểm tra thêm.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Hoạt động mới nhất
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {loading ? 'Đang tải...' : formatTimestamp(latestLog?.created_at)}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {latestLog ? humanizeAction(latestLog.action) : 'Chưa có bản ghi nào.'}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="min-w-[180px] flex-1">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Kết quả
            </label>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as AuditStatusFilter)
              }
              data-testid="audit-status-filter"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            >
              <option value="all">Mọi kết quả</option>
              <option value="success">Thành công</option>
              <option value="failure">Thất bại</option>
              <option value="denied">Bị chặn</option>
            </select>
          </div>

          <div className="min-w-[200px] flex-1">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Hành động
            </label>
            <input
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              data-testid="audit-action-filter"
              placeholder="Ví dụ: policy.update"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <div className="min-w-[200px] flex-1">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Khu vực bị tác động
            </label>
            <input
              value={resourceTypeFilter}
              onChange={(event) => setResourceTypeFilter(event.target.value)}
              data-testid="audit-resource-type-filter"
              placeholder="Ví dụ: admin_config, user..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <div className="min-w-[180px] flex-1">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Người thực hiện
            </label>
            <input
              value={userIdFilter}
              onChange={(event) => setUserIdFilter(event.target.value)}
              data-testid="audit-user-filter"
              placeholder="Ví dụ: admin"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void applyFilters()}
              data-testid="audit-apply"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Filter size={15} />
              Áp dụng
            </button>
            <button
              type="button"
              onClick={() => void resetFilters()}
              data-testid="audit-reset"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              <Search size={15} />
              Đặt lại
            </button>
          </div>
        </div>

        <div className="mt-4">
          <AdminTechnicalDetails
            testId="audit-filter-technical"
            description="Bộ lọc thời gian, mã đối tượng và giới hạn số dòng dành cho lúc cần truy vết sâu hơn."
          >
            <div className="grid gap-3 lg:grid-cols-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
                  Mã đối tượng
                </label>
                <input
                  value={resourceIdFilter}
                  onChange={(event) => setResourceIdFilter(event.target.value)}
                  data-testid="audit-resource-id-filter"
                  placeholder="Ví dụ: rag_policy, USR005..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
                  Từ thời điểm
                </label>
                <input
                  type="datetime-local"
                  value={fromFilter}
                  onChange={(event) => setFromFilter(event.target.value)}
                  data-testid="audit-from-filter"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
                  Đến thời điểm
                </label>
                <input
                  type="datetime-local"
                  value={toFilter}
                  onChange={(event) => setToFilter(event.target.value)}
                  data-testid="audit-to-filter"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
                  Số dòng
                </label>
                <select
                  value={String(limitFilter)}
                  onChange={(event) => setLimitFilter(Number(event.target.value))}
                  data-testid="audit-limit-filter"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                >
                  {LIMIT_OPTIONS.map((limit) => (
                    <option key={limit} value={String(limit)}>
                      {limit}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </AdminTechnicalDetails>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-50/70">
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 p-3">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-3">Hành động</th>
                  <th className="px-3">Khu vực bị tác động</th>
                  <th className="px-3">Người thực hiện</th>
                  <th className="px-3">Kết quả</th>
                  <th className="px-3">Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="rounded-2xl bg-white px-4 py-6 text-sm text-slate-500"
                    >
                      Đang tải nhật ký kiểm toán...
                    </td>
                  </tr>
                )}

                {!loading && logs.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="rounded-2xl bg-white px-4 py-6 text-sm text-slate-500"
                    >
                      Không có bản ghi nào khớp bộ lọc hiện tại.
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
                                : 'Không tải được chi tiết nhật ký kiểm toán.',
                            )
                          })
                        }}
                      >
                        <td className="rounded-l-2xl px-3 py-4 align-top">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-800">
                              {humanizeAction(log.action)}
                            </p>
                            <p className="text-xs text-slate-500">{log.reason ?? 'Không có ghi chú bổ sung.'}</p>
                          </div>
                        </td>
                        <td className="px-3 py-4 align-top text-sm text-slate-600">
                          <p className="font-semibold text-slate-800">
                            {humanizeResourceType(log.resource_type)}
                          </p>
                        </td>
                        <td className="px-3 py-4 align-top text-sm text-slate-600">
                          {log.user_id ?? 'Hệ thống'}
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
            Chi tiết hoạt động
          </h3>

          {detailLoading && (
            <p className="mt-4 text-sm text-slate-500">Đang tải chi tiết...</p>
          )}

          {!detailLoading && !selectedLog && (
            <p className="mt-4 text-sm text-slate-500">
              Chọn một bản ghi ở bên trái để xem nội dung thay đổi và các thông tin liên quan.
            </p>
          )}

          {!detailLoading && selectedLog && (
            <div className="mt-4 space-y-4">
              <dl className="grid gap-3 text-sm">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-slate-500">Hành động</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {humanizeAction(selectedLog.action)}
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-slate-500">Khu vực bị tác động</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {humanizeResourceType(selectedLog.resource_type)}
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-slate-500">Người thực hiện / kết quả</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {selectedLog.user_id ?? 'Hệ thống'} · {statusLabel(selectedLog.status)}
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-slate-500">Thời gian</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {formatTimestamp(selectedLog.created_at)}
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-slate-500">Ghi chú</dt>
                  <dd className="mt-1 text-slate-700">
                    {selectedLog.reason ?? 'Không có ghi chú bổ sung.'}
                  </dd>
                </div>
              </dl>

              <AdminTechnicalDetails
                testId="audit-technical-details"
                description="Bao gồm tên hành động gốc, mã đối tượng, IP, user agent và dữ liệu JSON trước/sau thay đổi."
              >
                <div className="space-y-4">
                  <dl className="grid gap-3 text-sm md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <dt className="text-slate-500">Raw action</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {selectedLog.action}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <dt className="text-slate-500">Raw resource ID</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {selectedLog.resource_id ?? 'Không có'}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <dt className="text-slate-500">IP address</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {selectedLog.ip_address ?? 'Không có'}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <dt className="text-slate-500">User agent</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {selectedLog.user_agent ?? 'Không có'}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <dt className="text-slate-500">HTTP status code</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        Chưa được ghi trong log hiện tại
                      </dd>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <dt className="text-slate-500">Bản ghi</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        #{selectedLog.id}
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
              </AdminTechnicalDetails>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
