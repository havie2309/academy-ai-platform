import {
  adminApi,
  type ServiceLogEntry as ApiServiceLogEntry,
  type ServiceLogLevel as ApiServiceLogLevel,
  type ServiceLogServiceMeta as ApiServiceLogServiceMeta,
  type ServiceLogStream,
} from './admin'

export type ServiceLogLevel = ApiServiceLogLevel
export type ServiceLogSort = 'newest' | 'oldest'
export type ServiceLogPageSize = 25 | 50 | 100 | 120

export interface ServiceLogSource {
  key: string
  label: string
  available: boolean
  fileCount: number
  entryCount: number
  lastUpdatedAt: string | null
  env: string
}

export interface ServiceLogEntry {
  id: string
  service: string
  serviceLabel: string
  level: ServiceLogLevel
  env: string
  timestamp: string | null
  message: string
  raw: string
  fileName: string
  filePath: string
  stream: ServiceLogStream
}

export interface ServiceLogSummaryCounts {
  debug: number
  info: number
  warn: number
  error: number
}

export interface ServiceLogQuery {
  service?: string
  level?: 'all' | Exclude<ServiceLogLevel, 'unknown'>
  search?: string
  from?: string
  to?: string
  sort?: ServiceLogSort
  page?: number
  pageSize?: ServiceLogPageSize
  limit?: number
}

export interface ServiceLogResponse {
  fetchedAt: string
  lastUpdatedAt: string | null
  sources: ServiceLogSource[]
  entries: ServiceLogEntry[]
  visibleEntries: ServiceLogEntry[]
  pageEntries: ServiceLogEntry[]
  totalVisible: number
  totalPages: number
  summary: ServiceLogSummaryCounts
  appliedQuery: Required<ServiceLogQuery>
}

export const ADMIN_SERVICE_LOG_PAGE_SIZES: ServiceLogPageSize[] = [
  25,
  50,
  100,
  120,
]

export const ADMIN_SERVICE_LOG_SOURCES: Array<Pick<ServiceLogSource, 'key' | 'label'>> = [
  { key: 'api-gateway', label: 'API Gateway' },
  { key: 'user-management', label: 'User Management' },
  { key: 'chat', label: 'Chat' },
  { key: 'rbac', label: 'RBAC' },
  { key: 'admin-config', label: 'Admin Config' },
  { key: 'audit', label: 'Audit' },
  { key: 'rag-engine', label: 'RAG Engine' },
  { key: 'document-processor', label: 'Document Processor' },
  { key: 'etl-sync', label: 'ETL Sync' },
  { key: 'embedding-server', label: 'Embedding Server' },
  { key: 'rerank-server', label: 'Rerank Server' },
]

const MAX_FETCH_LIMIT = 200

function inferEnvLabel(filePath: string): string {
  const normalized = filePath.trim().toLowerCase()
  if (!normalized) return 'Không xác định'
  if (
    normalized.includes('runtime-logs') ||
    normalized.includes('.tmp-startlogs')
  ) {
    return 'Dev'
  }
  if (normalized.includes('.codex')) return 'Cục bộ'
  if (normalized.includes('docker')) return 'Docker'
  return 'Vận hành'
}

function toIsoFromLocalInput(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

function sortEntries(
  entries: ServiceLogEntry[],
  sort: ServiceLogSort,
): ServiceLogEntry[] {
  const factor = sort === 'oldest' ? 1 : -1
  return entries.slice().sort((left, right) => {
    const leftMs = left.timestamp ? Date.parse(left.timestamp) : 0
    const rightMs = right.timestamp ? Date.parse(right.timestamp) : 0
    if (leftMs !== rightMs) {
      return (leftMs - rightMs) * factor
    }
    return left.id.localeCompare(right.id) * factor
  })
}

function normalizeEntry(entry: ApiServiceLogEntry): ServiceLogEntry {
  return {
    id: entry.id,
    service: entry.service,
    serviceLabel: entry.service_label,
    level: entry.level,
    env: inferEnvLabel(entry.file_path),
    timestamp: entry.timestamp,
    message: entry.message,
    raw: entry.raw,
    fileName: entry.file_name,
    filePath: entry.file_path,
    stream: entry.stream,
  }
}

function pickSourceEnv(entries: ServiceLogEntry[]): string {
  if (entries.length === 0) return 'Chưa có log'

  const counts = new Map<string, number>()
  for (const entry of entries) {
    counts.set(entry.env, (counts.get(entry.env) ?? 0) + 1)
  }

  const sorted = [...counts.entries()].sort((left, right) => right[1] - left[1])
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) {
    return 'Hỗn hợp'
  }

  return sorted[0]?.[0] ?? 'Không xác định'
}

function buildSources(
  apiSources: ApiServiceLogServiceMeta[],
  entries: ServiceLogEntry[],
): ServiceLogSource[] {
  const sourcesByKey = new Map<string, ApiServiceLogServiceMeta>()
  for (const source of apiSources) {
    sourcesByKey.set(source.key, source)
  }

  const entriesByService = new Map<string, ServiceLogEntry[]>()
  for (const entry of entries) {
    const bucket = entriesByService.get(entry.service) ?? []
    bucket.push(entry)
    entriesByService.set(entry.service, bucket)
  }

  return ADMIN_SERVICE_LOG_SOURCES.map((source) => {
    const apiSource = sourcesByKey.get(source.key)
    const sourceEntries = entriesByService.get(source.key) ?? []

    return {
      key: source.key,
      label: apiSource?.label ?? source.label,
      available: apiSource?.available ?? sourceEntries.length > 0,
      fileCount: apiSource?.file_count ?? 0,
      entryCount: sourceEntries.length,
      lastUpdatedAt: apiSource?.last_updated_at ?? null,
      env: pickSourceEnv(sourceEntries),
    }
  })
}

function buildSummary(entries: ServiceLogEntry[]): ServiceLogSummaryCounts {
  return entries.reduce<ServiceLogSummaryCounts>(
    (summary, entry) => {
      if (entry.level === 'debug') summary.debug += 1
      if (entry.level === 'info') summary.info += 1
      if (entry.level === 'warn') summary.warn += 1
      if (entry.level === 'error') summary.error += 1
      return summary
    },
    { debug: 0, info: 0, warn: 0, error: 0 },
  )
}

function resolveLastUpdatedAt(
  fetchedAt: string,
  sources: ServiceLogSource[],
  entries: ServiceLogEntry[],
): string | null {
  const timestamps = [
    ...sources.map((source) => source.lastUpdatedAt).filter(Boolean),
    ...entries.map((entry) => entry.timestamp).filter(Boolean),
    fetchedAt,
  ]
  const parsed = timestamps
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter((value) => Number.isFinite(value))

  if (parsed.length === 0) return null
  return new Date(Math.max(...parsed)).toISOString()
}

function normalizeQuery(query: ServiceLogQuery): Required<ServiceLogQuery> {
  const pageSize = ADMIN_SERVICE_LOG_PAGE_SIZES.includes(
    query.pageSize as ServiceLogPageSize,
  )
    ? (query.pageSize as ServiceLogPageSize)
    : 25

  return {
    service: query.service?.trim() || 'all',
    level: query.level ?? 'all',
    search: query.search?.trim() ?? '',
    from: query.from?.trim() ?? '',
    to: query.to?.trim() ?? '',
    sort: query.sort ?? 'newest',
    page: Math.max(1, query.page ?? 1),
    pageSize,
    limit: Math.max(pageSize, Math.min(MAX_FETCH_LIMIT, query.limit ?? MAX_FETCH_LIMIT)),
  }
}

export async function fetchAdminServiceLogs(
  query: ServiceLogQuery = {},
): Promise<ServiceLogResponse> {
  const appliedQuery = normalizeQuery(query)
  const payload = await adminApi.getServiceLogs({
    service:
      appliedQuery.service !== 'all' ? appliedQuery.service : undefined,
    level:
      appliedQuery.level !== 'all' ? appliedQuery.level : undefined,
    search: appliedQuery.search || undefined,
    from: toIsoFromLocalInput(appliedQuery.from),
    to: toIsoFromLocalInput(appliedQuery.to),
    limit: appliedQuery.limit,
  })

  const entries = payload.entries.map(normalizeEntry)
  const sources = buildSources(payload.services, entries)
  const visibleEntries = sortEntries(entries, appliedQuery.sort)
  const totalVisible = visibleEntries.length
  const totalPages = Math.max(1, Math.ceil(totalVisible / appliedQuery.pageSize))
  const currentPage = Math.min(appliedQuery.page, totalPages)
  const pageStart = (currentPage - 1) * appliedQuery.pageSize
  const pageEntries = visibleEntries.slice(
    pageStart,
    pageStart + appliedQuery.pageSize,
  )

  return {
    fetchedAt: payload.generated_at,
    lastUpdatedAt: resolveLastUpdatedAt(payload.generated_at, sources, entries),
    sources,
    entries,
    visibleEntries,
    pageEntries,
    totalVisible,
    totalPages,
    summary: buildSummary(visibleEntries),
    appliedQuery: {
      ...appliedQuery,
      page: currentPage,
    },
  }
}

export function buildAdminServiceLogsExport(
  response: ServiceLogResponse,
): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      query: response.appliedQuery,
      totalVisible: response.totalVisible,
      entries: response.visibleEntries,
    },
    null,
    2,
  )
}
