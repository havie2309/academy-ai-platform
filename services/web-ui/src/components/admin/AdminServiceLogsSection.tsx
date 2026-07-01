import { RefreshCw, Search, Server } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  adminApi,
  type ServiceLogEntry,
  type ServiceLogLevel,
  type ServiceLogServiceMeta,
  type ServiceLogsResponse,
} from '../../api/admin'
import AdminTechnicalDetails from './AdminTechnicalDetails'

const FALLBACK_SERVICES: ServiceLogServiceMeta[] = [
  {
    key: 'rag-engine',
    label: 'RAG Engine',
    available: false,
    file_count: 0,
    last_updated_at: null,
  },
  {
    key: 'document-processor',
    label: 'Document Processor',
    available: false,
    file_count: 0,
    last_updated_at: null,
  },
  {
    key: 'etl-sync',
    label: 'ETL Sync',
    available: false,
    file_count: 0,
    last_updated_at: null,
  },
]

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Chua co timestamp'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('vi-VN')
}

function toIsoFromLocalInput(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

function levelLabel(level: ServiceLogLevel): string {
  switch (level) {
    case 'debug':
      return 'Debug'
    case 'info':
      return 'Info'
    case 'warn':
      return 'Canh bao'
    case 'error':
      return 'Loi'
    default:
      return 'Khac'
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

function streamLabel(stream: ServiceLogEntry['stream']): string {
  switch (stream) {
    case 'stderr':
      return 'stderr'
    case 'stdout':
      return 'stdout'
    default:
      return 'combined'
  }
}

export default function AdminServiceLogsSection() {
  const [service, setService] = useState('all')
  const [level, setLevel] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState('120')
  const [payload, setPayload] = useState<ServiceLogsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const services = payload?.services?.length ? payload.services : FALLBACK_SERVICES

  const serviceSummary = useMemo(() => {
    return services.filter((item) => item.available).length
  }, [services])

  async function loadLogs() {
    setLoading(true)
    setError(null)
    try {
      const next = await adminApi.getServiceLogs({
        service: service === 'all' ? undefined : service,
        level: level === 'all' ? undefined : level,
        from: toIsoFromLocalInput(from),
        to: toIsoFromLocalInput(to),
        search: search.trim() || undefined,
        limit: Number(limit) || 120,
      })
      setPayload(next)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Khong tai duoc service logs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadLogs()
    // Intentional one-time initial load for the technical tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section
      data-testid="admin-service-logs-section"
      className="rounded-[2rem] border border-slate-200/70 bg-white/95 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            <Server size={14} />
            Service Logs
          </div>
          <h2 className="mt-3 text-2xl font-bold text-slate-900">
            Xem log cua cac service noi bo
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Dung cho admin kiem tra nhanh log cua RAG, document-processor, ETL va
            cac service backend khac ma khong can mo terminal.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadLogs()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
          data-testid="service-logs-refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Tai lai log
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="space-y-2 text-sm text-slate-600">
          <span className="font-semibold text-slate-700">Service</span>
          <select
            value={service}
            onChange={(event) => setService(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            data-testid="service-logs-service-filter"
          >
            <option value="all">Tat ca service</option>
            {services.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm text-slate-600">
          <span className="font-semibold text-slate-700">Muc do</span>
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            data-testid="service-logs-level-filter"
          >
            <option value="all">Tat ca</option>
            <option value="info">Info</option>
            <option value="warn">Canh bao</option>
            <option value="error">Loi</option>
            <option value="debug">Debug</option>
          </select>
        </label>

        <label className="space-y-2 text-sm text-slate-600">
          <span className="font-semibold text-slate-700">Tu thoi diem</span>
          <input
            type="datetime-local"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            data-testid="service-logs-from-filter"
          />
        </label>

        <label className="space-y-2 text-sm text-slate-600">
          <span className="font-semibold text-slate-700">Den thoi diem</span>
          <input
            type="datetime-local"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            data-testid="service-logs-to-filter"
          />
        </label>

        <label className="space-y-2 text-sm text-slate-600 xl:col-span-2">
          <span className="font-semibold text-slate-700">Tim trong log</span>
          <div className="flex rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
            <Search size={16} className="mt-0.5 shrink-0 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="VD: timeout, revoke, denied..."
              className="ml-2 w-full border-none bg-transparent text-sm text-slate-700 outline-none"
              data-testid="service-logs-search-filter"
            />
          </div>
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {services.map((item) => (
            <span
              key={item.key}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                item.available
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              {item.label}
              <span className="font-normal">
                {item.available ? `${item.file_count} file` : 'chua co log'}
              </span>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3 text-sm text-slate-500">
          <label className="flex items-center gap-2">
            <span>Gioi han</span>
            <select
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 outline-none"
              data-testid="service-logs-limit-filter"
            >
              <option value="50">50 dong</option>
              <option value="120">120 dong</option>
              <option value="200">200 dong</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void loadLogs()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            data-testid="service-logs-apply"
          >
            Ap dung bo loc
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
        <span>
          Service co log: <strong className="text-slate-700">{serviceSummary}</strong> /{' '}
          {services.length}
        </span>
        <span>
          So dong dang hien:{' '}
          <strong className="text-slate-700">{payload?.entries.length ?? 0}</strong>
        </span>
        <span>
          Cap nhat lan cuoi:{' '}
          <strong className="text-slate-700">
            {formatTimestamp(payload?.generated_at)}
          </strong>
        </span>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!error && payload && payload.entries.length === 0 && !loading && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-relaxed text-amber-800">
          Chua tim thay dong log nao theo bo loc hien tai. Neu dang chay local,
          hay bat service qua <code>scripts/start-rag.ps1</code>,{' '}
          <code>scripts/start-dev.ps1</code> hoac <code>scripts/start-app.ps1</code>{' '}
          de he thong ghi log ra file.
        </div>
      )}

      <div className="mt-5 space-y-3">
        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            Dang tai service logs...
          </div>
        )}

        {!loading &&
          (payload?.entries ?? []).map((entry) => (
            <details
              key={entry.id}
              className="rounded-2xl border border-slate-200 bg-white"
              data-testid={`service-log-row-${entry.id}`}
            >
              <summary className="flex cursor-pointer list-none flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {entry.service_label}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${levelTone(entry.level)}`}
                    >
                      {levelLabel(entry.level)}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
                      {streamLabel(entry.stream)}
                    </span>
                  </div>
                  <p className="mt-2 break-words text-sm font-semibold text-slate-800">
                    {entry.message}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {entry.file_name}
                    {entry.timestamp ? ` · ${formatTimestamp(entry.timestamp)}` : ''}
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Mo
                </span>
              </summary>

              <div className="border-t border-slate-200 px-4 py-4">
                <AdminTechnicalDetails
                  title="Chi tiet ky thuat"
                  description="Raw line va nguon file cua ban ghi log nay."
                >
                  <div className="space-y-4">
                    <dl className="grid gap-3 text-sm md:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <dt className="text-slate-500">Service</dt>
                        <dd className="mt-1 font-semibold text-slate-800">
                          {entry.service_label}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <dt className="text-slate-500">Level / stream</dt>
                        <dd className="mt-1 font-semibold text-slate-800">
                          {levelLabel(entry.level)} / {streamLabel(entry.stream)}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 md:col-span-2">
                        <dt className="text-slate-500">File log</dt>
                        <dd className="mt-1 break-all font-mono text-xs text-slate-700">
                          {entry.file_path}
                        </dd>
                      </div>
                    </dl>
                    <div className="rounded-xl border border-slate-200 bg-slate-950 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Raw log line
                      </p>
                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-100">
                        {entry.raw}
                      </pre>
                    </div>
                  </div>
                </AdminTechnicalDetails>
              </div>
            </details>
          ))}
      </div>
    </section>
  )
}
