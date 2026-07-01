import {
  AlertTriangle,
  Bug,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Info,
  RefreshCw,
  Search,
  Server,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  ADMIN_SERVICE_LOG_PAGE_SIZES,
  ADMIN_SERVICE_LOG_SOURCES,
  buildAdminServiceLogsExport,
  fetchAdminServiceLogs,
  type ServiceLogEntry,
  type ServiceLogLevel,
  type ServiceLogPageSize,
  type ServiceLogQuery,
  type ServiceLogResponse,
  type ServiceLogSort,
} from '../../api/adminLogs'

type ServiceFilterValue = 'all' | (typeof ADMIN_SERVICE_LOG_SOURCES)[number]['key']
type LevelFilterValue = 'all' | Exclude<ServiceLogLevel, 'unknown'>

interface FilterDraft {
  service: ServiceFilterValue
  level: LevelFilterValue
  search: string
  from: string
  to: string
  sort: ServiceLogSort
  pageSize: ServiceLogPageSize
}

const DEFAULT_FILTER_DRAFT: FilterDraft = {
  service: 'all',
  level: 'all',
  search: '',
  from: '',
  to: '',
  sort: 'newest',
  pageSize: 25,
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Không có thời gian'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('vi-VN')
}

function formatCountLabel(count: number): string {
  if (count === 1) return '1 dòng'
  return `${count} dòng`
}

function levelLabel(level: ServiceLogLevel): string {
  switch (level) {
    case 'debug':
      return 'Gỡ lỗi'
    case 'info':
      return 'Thông tin'
    case 'warn':
      return 'Cảnh báo'
    case 'error':
      return 'Lỗi'
    default:
      return 'Khác'
  }
}

function levelTone(level: ServiceLogLevel): string {
  switch (level) {
    case 'debug':
      return 'border-slate-200 bg-slate-50 text-slate-600'
    case 'info':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'warn':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'error':
      return 'border-red-200 bg-red-50 text-red-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-500'
  }
}

function summaryCardStyles(level: Exclude<ServiceLogLevel, 'unknown'>) {
  switch (level) {
    case 'debug':
      return {
        card: 'border-slate-200 bg-slate-50/40 hover:bg-slate-50/80 transition-all duration-300 hover:shadow-sm',
        number: 'text-slate-800',
        iconContainer: 'border-slate-200 bg-slate-100 text-slate-600',
      }
    case 'info':
      return {
        card: 'border-blue-100 bg-blue-50/30 hover:bg-blue-50/60 transition-all duration-300 hover:shadow-[0_8px_30px_-15px_rgba(59,130,246,0.15)]',
        number: 'text-blue-600',
        iconContainer: 'border-blue-200 bg-blue-100/80 text-blue-600',
      }
    case 'warn':
      return {
        card: 'border-amber-100 bg-amber-50/30 hover:bg-amber-50/60 transition-all duration-300 hover:shadow-[0_8px_30px_-15px_rgba(245,158,11,0.15)]',
        number: 'text-amber-600',
        iconContainer: 'border-amber-200 bg-amber-100/80 text-amber-600',
      }
    case 'error':
      return {
        card: 'border-red-100 bg-red-50/30 hover:bg-red-50/60 transition-all duration-300 hover:shadow-[0_12px_40px_-20px_rgba(239,68,68,0.25)]',
        number: 'text-red-600',
        iconContainer: 'border-red-200 bg-red-100/80 text-red-600',
      }
  }
}

function summaryIcon(level: Exclude<ServiceLogLevel, 'unknown'>) {
  switch (level) {
    case 'debug':
      return Bug
    case 'info':
      return Info
    case 'warn':
      return AlertTriangle
    case 'error':
      return AlertTriangle
  }
}

function humanizeError(message: string): {
  title: string
  summary: string
} {
  if (message.includes('401')) {
    return {
      title: 'Phiên đăng nhập đã hết hạn',
      summary: 'Vui lòng đăng nhập lại trước khi mở màn hình xem log.',
    }
  }

  if (message.includes('403')) {
    return {
      title: 'Truy cập bị chặn',
      summary: 'Tài khoản này không có quyền xem log dịch vụ.',
    }
  }

  if (message.includes('504')) {
    return {
      title: 'Dịch vụ log đang phản hồi chậm',
      summary: 'Hãy thử tải lại sau ít phút. Hệ thống có thể vẫn đang thu thập log.',
    }
  }

  return {
    title: 'Không tải được log dịch vụ',
    summary: 'Màn hình xem log đang tạm thời không khả dụng. Vui lòng thử lại.',
  }
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function buildExportFileName(): string {
  const now = new Date().toISOString().replace(/[:.]/g, '-')
  return `nhat-ky-dich-vu-${now}.json`
}

export default function AdminServiceLogsSection() {
  const [draft, setDraft] = useState<FilterDraft>(DEFAULT_FILTER_DRAFT)
  const [query, setQuery] = useState<ServiceLogQuery>({
    ...DEFAULT_FILTER_DRAFT,
    page: 1,
  })
  const [data, setData] = useState<ServiceLogResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadLogs() {
      setLoading(true)
      setError(null)
      try {
        const next = await fetchAdminServiceLogs(query)
        if (cancelled) return
        setData(next)
        setExpandedRowId((current) =>
          current && next.visibleEntries.some((entry) => entry.id === current)
            ? current
            : null,
        )
      } catch (loadError) {
        if (cancelled) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Không tải được log dịch vụ.',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadLogs()
    return () => {
      cancelled = true
    }
  }, [query])

  const sidebarSources = useMemo(() => {
    if (data?.sources?.length) {
      return data.sources
    }

    return ADMIN_SERVICE_LOG_SOURCES.map((source) => ({
      key: source.key,
      label: source.label,
      available: false,
      fileCount: 0,
      entryCount: 0,
      lastUpdatedAt: null,
      env: 'Chưa có log',
    }))
  }, [data])

  const totalSourceCount = sidebarSources.length
  const totalVisibleLogs = data?.totalVisible ?? 0
  const visiblePageCount = data?.pageEntries.length ?? 0
  const appliedPage = data?.appliedQuery.page ?? 1
  const totalPages = data?.totalPages ?? 1
  const lastUpdated = data?.lastUpdatedAt ?? data?.fetchedAt ?? null

  const errorState = error ? humanizeError(error) : null

  async function refreshLogs() {
    setQuery((current) => ({ ...current }))
  }

  function applyFilters() {
    setQuery({
      ...draft,
      page: 1,
    })
  }

  function changePage(nextPage: number) {
    setQuery((current) => ({
      ...current,
      page: nextPage,
    }))
  }

  function selectService(service: ServiceFilterValue) {
    const nextDraft = {
      ...draft,
      service,
    }
    setDraft(nextDraft)
    setQuery({
      ...nextDraft,
      page: 1,
    })
  }

  async function exportLogs() {
    if (!data || data.totalVisible === 0) {
      return
    }
    downloadTextFile(
      buildExportFileName(),
      buildAdminServiceLogsExport(data),
    )
  }

  async function copyRawLog(entry: ServiceLogEntry) {
    try {
      await copyText(entry.raw)
      setCopiedRowId(entry.id)
      window.setTimeout(() => {
        setCopiedRowId((current) => (current === entry.id ? null : current))
      }, 1400)
    } catch {
      setCopiedRowId(null)
    }
  }

  function toggleDetail(entryId: string) {
    setExpandedRowId((current) => (current === entryId ? null : entryId))
  }

  return (
    <section
      data-testid="admin-service-logs-section"
      className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white/95 shadow-[0_22px_70px_-42px_rgba(15,23,42,0.38)]"
    >
      <div className="border-b border-slate-200/80 bg-slate-50/80 px-6 py-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              <Server size={14} />
              Trình xem log dịch vụ
            </div>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">
              Xem log các dịch vụ nội bộ tại một nơi
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm text-slate-600">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Cập nhật lần cuối
              </p>
              <p className="mt-1 font-semibold text-slate-800">
                {formatTimestamp(lastUpdated)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(
            [
              ['debug', data?.summary.debug ?? 0],
              ['info', data?.summary.info ?? 0],
              ['warn', data?.summary.warn ?? 0],
              ['error', data?.summary.error ?? 0],
            ] as Array<[Exclude<ServiceLogLevel, 'unknown'>, number]>
          ).map(([level, count]) => {
            const Icon = summaryIcon(level)
            const styles = summaryCardStyles(level)
            return (
              <div
                key={level}
                className={`rounded-2xl border px-4 py-3.5 ${styles.card}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {levelLabel(level)}
                    </p>
                    <p className={`mt-1.5 text-2xl font-extrabold ${styles.number}`}>
                      {count}
                    </p>
                  </div>
                  <div className={`rounded-xl border p-2 shadow-sm ${styles.iconContainer}`}>
                    <Icon size={18} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200/80 bg-slate-50/80 p-4 xl:border-b-0 xl:border-r">
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              Nguồn log
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => selectService('all')}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                draft.service === 'all'
                  ? 'border-slate-900 bg-slate-900 text-white shadow-[0_16px_34px_-24px_rgba(15,23,42,0.65)]'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Tất cả dịch vụ</p>
                  <p
                    className={`mt-1 text-xs ${
                      draft.service === 'all' ? 'text-slate-200' : 'text-slate-500'
                    }`}
                  >
                    {totalSourceCount} nguồn đã cấu hình
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    draft.service === 'all'
                      ? 'bg-white/15 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {formatCountLabel(totalVisibleLogs)}
                </span>
              </div>
            </button>

            {sidebarSources.map((source) => {
              const isActive = draft.service === source.key
              return (
                <button
                  key={source.key}
                  type="button"
                  onClick={() => selectService(source.key as ServiceFilterValue)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    isActive
                      ? 'border-blue-200 bg-blue-50 text-slate-900 shadow-[0_16px_34px_-28px_rgba(59,130,246,0.55)]'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            source.available ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                        <p className="truncate text-sm font-semibold">
                          {source.label}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {source.env} / {source.fileCount} file
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isActive
                          ? 'bg-white text-blue-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {source.entryCount}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="min-w-0 p-4 sm:p-6">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              applyFilters()
            }}
            className="rounded-[1.75rem] border border-slate-200 bg-slate-50/80 p-4"
          >
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-6">
              <label className="space-y-2 text-sm text-slate-600 xl:col-span-2">
                <span className="font-semibold text-slate-700">Tìm trong nội dung</span>
                <div className="flex rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                  <Search size={16} className="mt-0.5 shrink-0 text-slate-400" />
                  <input
                    type="text"
                    value={draft.search}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        search: event.target.value,
                      }))
                    }
                    placeholder="Ví dụ: timeout, revoke, denied, stacktrace..."
                    
                    className="ml-2 w-full border-none bg-transparent text-sm text-slate-700 outline-none"
                    data-testid="service-logs-search-filter"
                  />
                </div>
              </label>

              <label className="space-y-2 text-sm text-slate-600">
                <span className="font-semibold text-slate-700">Mức độ</span>
                <select
                  value={draft.level}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      level: event.target.value as LevelFilterValue,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  data-testid="service-logs-level-filter"
                >
                  <option value="all">Tất cả</option>
                  <option value="debug">Gỡ lỗi</option>
                  <option value="info">Thông tin</option>
                  <option value="warn">Cảnh báo</option>
                  <option value="error">Lỗi</option>
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-600">
                <span className="font-semibold text-slate-700">Từ thời điểm</span>
                <input
                  type="datetime-local"
                  value={draft.from}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      from: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  data-testid="service-logs-from-filter"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-600">
                <span className="font-semibold text-slate-700">Đến thời điểm</span>
                <input
                  type="datetime-local"
                  value={draft.to}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      to: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  data-testid="service-logs-to-filter"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-600">
                <span className="font-semibold text-slate-700">Sắp xếp</span>
                <select
                  value={draft.sort}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      sort: event.target.value as ServiceLogSort,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="newest">Mới nhất trước</option>
                  <option value="oldest">Cũ nhất trước</option>
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <label className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Số dòng mỗi trang</span>
                  <select
                    value={draft.pageSize}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        pageSize: Number(event.target.value) as ServiceLogPageSize,
                      }))
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    data-testid="service-logs-limit-filter"
                  >
                    {ADMIN_SERVICE_LOG_PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void refreshLogs()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading}
                  data-testid="service-logs-refresh"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  Tải lại
                </button>
                <button
                  type="button"
                  onClick={() => void exportLogs()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!data || data.totalVisible === 0}
                >
                  <Download size={16} />
                  Xuất JSON
                </button>
                <button
                  type="submit"
                  className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading}
                  data-testid="service-logs-apply"
                >
                  Áp dụng bộ lọc
                </button>
              </div>
            </div>
          </form>

          {errorState && (
            <div className="mt-4 rounded-[1.5rem] border border-red-200 bg-red-50/90 p-4">
              <p className="text-sm font-semibold text-red-700">{errorState.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-red-700/90">
                {errorState.summary}
              </p>
              <details className="mt-3 rounded-xl border border-red-100 bg-white/75">
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide text-red-500">
                  Chi tiết kỹ thuật
                </summary>
                <div className="border-t border-red-100 px-3 py-3">
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">
                    {error}
                  </pre>
                </div>
              </details>
            </div>
          )}

          {!error && loading && (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`service-log-skeleton-${index}`}
                  className="animate-pulse rounded-[1.5rem] border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-20 rounded-full bg-slate-100" />
                    <div className="h-8 w-28 rounded-full bg-slate-100" />
                    <div className="h-4 w-24 rounded bg-slate-100" />
                  </div>
                  <div className="mt-4 h-4 w-3/4 rounded bg-slate-100" />
                  <div className="mt-2 h-4 w-1/2 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          )}

          {!error && !loading && data && data.totalVisible === 0 && (
            <div className="mt-4 rounded-[1.5rem] border border-amber-200 bg-amber-50/80 p-5 text-sm leading-relaxed text-amber-900">
              <p className="font-semibold">Không có log nào khớp với bộ lọc hiện tại.</p>
              <p className="mt-1">
                Hãy mở rộng khoảng thời gian, xóa từ khóa tìm kiếm hoặc khởi
                động lại các service cục bộ để tạo log mới.
              </p>
            </div>
          )}

          {!error && !loading && data && data.totalVisible > 0 && (
            <>
              <div className="mt-4 flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Danh sách log</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Bấm vào từng dòng hoặc nút thao tác để xem log thô và stack
                    trace.
                  </p>
                </div>
                <div className="text-sm text-slate-500">
                  Đang hiển thị {visiblePageCount} / {data.totalVisible} dòng
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto pr-1">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50/85">
                      <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <th className="px-3 py-2">Mức độ</th>
                        <th className="px-3 py-2">Dịch vụ</th>
                        <th className="px-3 py-2">Thời gian</th>
                        <th className="px-3 py-2">Nội dung</th>
                        <th className="px-3 py-2 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data.pageEntries.map((entry) => {
                        const expanded = expandedRowId === entry.id
                        return (
                          <Fragment key={entry.id}>
                            <tr
                              data-testid={`service-log-row-${entry.id}`}
                              className={`cursor-pointer transition hover:bg-slate-50/70 ${
                                entry.level === 'error'
                                  ? 'bg-red-50/20'
                                  : entry.level === 'warn'
                                    ? 'bg-amber-50/20'
                                    : ''
                              }`}
                              onClick={() => toggleDetail(entry.id)}
                            >
                              <td className="px-3 py-2 align-top">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${levelTone(entry.level)}`}
                                >
                                  {levelLabel(entry.level)}
                                </span>
                              </td>
                              <td className="px-3 py-2 align-top">
                                <p className="text-sm font-semibold text-slate-800">
                                  {entry.serviceLabel}
                                </p>
                              </td>
                              <td className="px-3 py-2 align-top text-sm text-slate-600">
                                {formatTimestamp(entry.timestamp)}
                              </td>
                              <td className="px-3 py-2 align-top">
                                <p className="max-w-[320px] truncate text-sm text-slate-700">
                                  {entry.message}
                                </p>
                              </td>
                              <td className="px-3 py-2 align-top text-right">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    toggleDetail(entry.id)
                                  }}
                                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                                >
                                  {entry.level === 'error' ? 'Ngoại lệ' : 'Xem chi tiết'}
                                  <ChevronDown
                                    size={14}
                                    className={expanded ? 'rotate-180 transition' : 'transition'}
                                  />
                                </button>
                              </td>
                            </tr>

                            {expanded && (
                              <tr data-testid={`service-log-detail-${entry.id}`}>
                                <td colSpan={5} className="bg-slate-50/70 px-4 py-4">
                                  <div className="space-y-4 rounded-[1.25rem] border border-slate-200 bg-white p-4">
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                          Dịch vụ
                                        </p>
                                        <p className="mt-2 text-sm font-semibold text-slate-800">
                                          {entry.serviceLabel}
                                        </p>
                                      </div>
                                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                          Mức độ
                                        </p>
                                        <p className="mt-2 text-sm font-semibold text-slate-800">
                                          {levelLabel(entry.level)}
                                        </p>
                                      </div>
                                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                          Tệp
                                        </p>
                                        <p className="mt-2 truncate text-sm font-semibold text-slate-800">
                                          {entry.fileName}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="rounded-[1.25rem] border border-slate-900/80 bg-slate-950 p-4">
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                            Log thô / stack trace
                                          </p>
                                          <p className="mt-1 text-xs text-slate-500">
                                            {entry.filePath}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => void copyRawLog(entry)}
                                          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
                                        >
                                          <Copy size={14} />
                                          {copiedRowId === entry.id ? 'Đã sao chép' : 'Sao chép log'}
                                        </button>
                                      </div>
                                      <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-100">
                                        {entry.raw}
                                      </pre>
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

              <div className="mt-4 flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-600">
                  Trang {appliedPage} / {totalPages} - đang hiển thị {formatCountLabel(totalVisibleLogs)}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => changePage(appliedPage - 1)}
                    disabled={appliedPage <= 1}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft size={16} />
                    Trước
                  </button>
                  <button
                    type="button"
                    onClick={() => changePage(appliedPage + 1)}
                    disabled={appliedPage >= totalPages}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Sau
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
