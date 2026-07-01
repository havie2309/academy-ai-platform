import { promises as fs } from 'node:fs'
import * as path from 'node:path'

const ANSI_ESCAPE_PATTERN = /\u001b\[[0-9;]*m/g
const DEFAULT_TAIL_BYTES = 512 * 1024
const DEFAULT_SCAN_LINES = 600

export type ServiceLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'unknown'
export type ServiceLogStream = 'stdout' | 'stderr' | 'combined'

export interface ServiceLogCatalogEntry {
  key: string
  label: string
  filePrefixes: string[]
}

export interface ServiceLogEntry {
  id: string
  service: string
  service_label: string
  level: ServiceLogLevel
  timestamp: string | null
  message: string
  raw: string
  file_name: string
  file_path: string
  stream: ServiceLogStream
}

export interface ServiceLogServiceMeta {
  key: string
  label: string
  available: boolean
  file_count: number
  last_updated_at: string | null
}

export interface ServiceLogsResponse {
  generated_at: string
  services: ServiceLogServiceMeta[]
  entries: ServiceLogEntry[]
}

export interface ServiceLogFilters {
  service?: string
  level?: string
  from?: string
  to?: string
  search?: string
  limit?: string
}

interface ServiceLogFile {
  service: ServiceLogCatalogEntry
  fileName: string
  filePath: string
  stream: ServiceLogStream
  mtimeMs: number
}

interface ParsedServiceLogEntry extends ServiceLogEntry {
  sort_timestamp_ms: number
  file_mtime_ms: number
  line_index: number
}

export const SERVICE_LOG_CATALOG: ServiceLogCatalogEntry[] = [
  {
    key: 'api-gateway',
    label: 'API Gateway',
    filePrefixes: ['api-gateway'],
  },
  {
    key: 'user-management',
    label: 'User Management',
    filePrefixes: ['user-management'],
  },
  {
    key: 'chat',
    label: 'Chat',
    filePrefixes: ['chat'],
  },
  {
    key: 'rbac',
    label: 'RBAC',
    filePrefixes: ['rbac'],
  },
  {
    key: 'admin-config',
    label: 'Admin Config',
    filePrefixes: ['admin-config', 'admin'],
  },
  {
    key: 'audit',
    label: 'Audit',
    filePrefixes: ['audit'],
  },
  {
    key: 'embedding-server',
    label: 'Embedding Server',
    filePrefixes: ['embedding-server'],
  },
  {
    key: 'rerank-server',
    label: 'Rerank Server',
    filePrefixes: ['rerank-server'],
  },
  {
    key: 'rag-engine',
    label: 'RAG Engine',
    filePrefixes: ['rag-engine'],
  },
  {
    key: 'document-processor',
    label: 'Document Processor',
    filePrefixes: ['document-processor'],
  },
  {
    key: 'etl-sync',
    label: 'ETL Sync',
    filePrefixes: ['etl-sync'],
  },
]

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const value of values) {
    const normalized = value.trim()
    if (!normalized) {
      continue
    }
    const key = normalized.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    deduped.push(normalized)
  }
  return deduped
}

function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_PATTERN, '')
}

function normalizeLogLevel(
  rawLevel: string | null | undefined,
  stream: ServiceLogStream,
): ServiceLogLevel {
  const level = (rawLevel ?? '').trim().toLowerCase()
  if (level === 'debug' || level === 'trace') return 'debug'
  if (level === 'info' || level === 'log' || level === 'verbose') return 'info'
  if (level === 'warn' || level === 'warning') return 'warn'
  if (
    level === 'error' ||
    level === 'err' ||
    level === 'fatal' ||
    level === 'critical'
  ) {
    return 'error'
  }
  return stream === 'stderr' ? 'error' : 'unknown'
}

function normalizeLevelFilter(rawLevel: string | undefined): ServiceLogLevel | null {
  const trimmed = rawLevel?.trim()
  if (!trimmed) {
    return null
  }
  const normalized = normalizeLogLevel(trimmed, 'combined')
  return normalized === 'unknown' ? null : normalized
}

function normalizeServiceFilter(service: string | undefined): string | null {
  const trimmed = service?.trim()
  if (!trimmed || trimmed.toLowerCase() === 'all') {
    return null
  }
  return trimmed.toLowerCase()
}

function parseTimeFilter(rawValue: string | undefined): number | null {
  const trimmed = rawValue?.trim()
  if (!trimmed) {
    return null
  }
  const parsed = Date.parse(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function inferStream(fileName: string): ServiceLogStream {
  const lower = fileName.toLowerCase()
  if (lower.includes('.err.') || lower.endsWith('.err.log')) {
    return 'stderr'
  }
  if (lower.includes('.out.') || lower.endsWith('.out.log')) {
    return 'stdout'
  }
  return 'combined'
}

function matchesServiceFile(
  fileName: string,
  service: ServiceLogCatalogEntry,
): boolean {
  const lower = fileName.toLowerCase()
  return service.filePrefixes.some((prefix) => {
    const normalized = prefix.toLowerCase()
    return (
      lower === `${normalized}.log` ||
      lower.startsWith(`${normalized}.`) ||
      lower.startsWith(`${normalized}-`)
    )
  })
}

function parseTimestamp(rawValue: string | null | undefined): string | null {
  if (!rawValue) {
    return null
  }
  const parsed = Date.parse(rawValue)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return new Date(parsed).toISOString()
}

function parseLogLine(
  file: ServiceLogFile,
  rawLine: string,
  lineIndex: number,
): ParsedServiceLogEntry | null {
  const raw = rawLine.replace(/\r$/, '')
  const clean = stripAnsi(raw).trim()
  if (!clean) {
    return null
  }

  let timestamp: string | null = null
  let level = normalizeLogLevel(null, file.stream)
  let message = clean

  if (clean.startsWith('{') && clean.endsWith('}')) {
    try {
      const payload = JSON.parse(clean) as Record<string, unknown>
      timestamp =
        parseTimestamp(
          typeof payload.timestamp === 'string' ? payload.timestamp : null,
        ) ??
        parseTimestamp(typeof payload.time === 'string' ? payload.time : null)
      level = normalizeLogLevel(
        typeof payload.level === 'string' ? payload.level : null,
        file.stream,
      )
      const payloadMessage =
        typeof payload.message === 'string'
          ? payload.message
          : typeof payload.msg === 'string'
            ? payload.msg
            : null
      if (payloadMessage?.trim()) {
        message = payloadMessage.trim()
      }
    } catch {
      // Fall back to regex-based parsing below.
    }
  }

  if (!timestamp) {
    const prefixedMatch = clean.match(
      /^(?<timestamp>\d{4}-\d{2}-\d{2}T\S+)\s+\[(?<level>[A-Za-z]+)\]\s+(?<message>.*)$/,
    )
    if (prefixedMatch?.groups) {
      timestamp = parseTimestamp(prefixedMatch.groups.timestamp)
      level = normalizeLogLevel(prefixedMatch.groups.level, file.stream)
      message = prefixedMatch.groups.message.trim() || clean
    }
  }

  if (!timestamp) {
    const nestMatch = clean.match(
      /\[Nest\].*-\s(?<timestamp>\d{1,2}\/\d{1,2}\/\d{4},\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)\s+(?<level>LOG|WARN|ERROR|DEBUG|VERBOSE)\s+(?<message>.*)$/i,
    )
    if (nestMatch?.groups) {
      timestamp = parseTimestamp(nestMatch.groups.timestamp)
      level = normalizeLogLevel(nestMatch.groups.level, file.stream)
      message = nestMatch.groups.message.trim() || clean
    }
  }

  if (timestamp == null) {
    const uvicornMatch = clean.match(
      /^(?<level>INFO|WARNING|ERROR|DEBUG|CRITICAL):\s+(?<message>.*)$/i,
    )
    if (uvicornMatch?.groups) {
      level = normalizeLogLevel(uvicornMatch.groups.level, file.stream)
      message = uvicornMatch.groups.message.trim() || clean
    }
  }

  if (message === clean && clean.includes('Traceback')) {
    level = 'error'
  }

  const sortTimestampMs = timestamp ? Date.parse(timestamp) : file.mtimeMs

  return {
    id: `${file.service.key}:${file.fileName}:${lineIndex}`,
    service: file.service.key,
    service_label: file.service.label,
    level,
    timestamp,
    message,
    raw: clean,
    file_name: file.fileName,
    file_path: file.filePath,
    stream: file.stream,
    sort_timestamp_ms: Number.isFinite(sortTimestampMs)
      ? sortTimestampMs
      : file.mtimeMs,
    file_mtime_ms: file.mtimeMs,
    line_index: lineIndex,
  }
}

async function readTailText(filePath: string, maxBytes = DEFAULT_TAIL_BYTES): Promise<string> {
  const handle = await fs.open(filePath, 'r')
  try {
    const stats = await handle.stat()
    if (stats.size <= 0) {
      return ''
    }

    const bytesToRead = Math.min(stats.size, maxBytes)
    const buffer = Buffer.alloc(bytesToRead)
    await handle.read(buffer, 0, bytesToRead, stats.size - bytesToRead)
    return buffer.toString('utf8')
  } finally {
    await handle.close()
  }
}

export function resolveServiceLogRoots(
  configuredRoots: string | undefined,
  cwd = process.cwd(),
): string[] {
  const repoRoot = path.resolve(cwd, '..', '..')
  const defaults = [
    path.join(repoRoot, '.tmp-startlogs'),
    path.join(repoRoot, '.codex', 'app-runtime', 'logs'),
    path.join(repoRoot, '.codex', 'runlogs'),
  ]

  const configured = dedupeStrings((configuredRoots ?? '').split(','))
  return dedupeStrings([...configured, ...defaults])
}

export async function readServiceLogs(input: {
  logRoots: string[]
  filters: ServiceLogFilters
}): Promise<ServiceLogsResponse> {
  const requestedService = normalizeServiceFilter(input.filters.service)
  if (
    requestedService &&
    !SERVICE_LOG_CATALOG.some((service) => service.key === requestedService)
  ) {
    throw new Error('invalid_service')
  }

  const levelFilter = normalizeLevelFilter(input.filters.level)
  const fromMs = parseTimeFilter(input.filters.from)
  const toMs = parseTimeFilter(input.filters.to)
  const search = input.filters.search?.trim().toLowerCase() ?? ''
  const limit = Math.max(1, Math.min(200, Number(input.filters.limit ?? 120) || 120))

  const selectedServices = SERVICE_LOG_CATALOG.filter((service) =>
    requestedService ? service.key === requestedService : true,
  )

  const serviceFiles = new Map<string, ServiceLogFile[]>()
  for (const service of SERVICE_LOG_CATALOG) {
    serviceFiles.set(service.key, [])
  }

  for (const root of dedupeStrings(input.logRoots)) {
    let entries: Array<{ isFile(): boolean; name: string | Buffer }> = []
    try {
      entries = await fs.readdir(root, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue
      }

      const entryName = String(entry.name)

      for (const service of SERVICE_LOG_CATALOG) {
        if (!matchesServiceFile(entryName, service)) {
          continue
        }

        const filePath = path.join(root, entryName)
        try {
          const stats = await fs.stat(filePath)
          const bucket = serviceFiles.get(service.key)
          bucket?.push({
            service,
            fileName: entryName,
            filePath,
            stream: inferStream(entryName),
            mtimeMs: stats.mtimeMs,
          })
        } catch {
          // Ignore files that disappear while scanning.
        }
      }
    }
  }

  const services = SERVICE_LOG_CATALOG.map((service) => {
    const files = serviceFiles.get(service.key) ?? []
    const lastUpdatedMs = files.reduce(
      (max, file) => Math.max(max, file.mtimeMs),
      0,
    )
    return {
      key: service.key,
      label: service.label,
      available: files.length > 0,
      file_count: files.length,
      last_updated_at:
        lastUpdatedMs > 0 ? new Date(lastUpdatedMs).toISOString() : null,
    }
  })

  const parsedEntries: ParsedServiceLogEntry[] = []

  for (const service of selectedServices) {
    const files = (serviceFiles.get(service.key) ?? [])
      .slice()
      .sort((left, right) => right.mtimeMs - left.mtimeMs)
      .slice(0, 4)

    for (const file of files) {
      const text = await readTailText(file.filePath)
      const lines = text
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .slice(-DEFAULT_SCAN_LINES)

      lines.forEach((line, index) => {
        const parsed = parseLogLine(file, line, index)
        if (!parsed) {
          return
        }

        if (levelFilter && parsed.level !== levelFilter) {
          return
        }
        if (search) {
          const haystack = `${parsed.message} ${parsed.raw} ${parsed.file_name}`.toLowerCase()
          if (!haystack.includes(search)) {
            return
          }
        }
        if ((fromMs != null || toMs != null) && parsed.timestamp == null) {
          return
        }
        if (fromMs != null && parsed.timestamp != null && Date.parse(parsed.timestamp) < fromMs) {
          return
        }
        if (toMs != null && parsed.timestamp != null && Date.parse(parsed.timestamp) > toMs) {
          return
        }

        parsedEntries.push(parsed)
      })
    }
  }

  parsedEntries.sort((left, right) => {
    if (right.sort_timestamp_ms !== left.sort_timestamp_ms) {
      return right.sort_timestamp_ms - left.sort_timestamp_ms
    }
    if (right.file_mtime_ms !== left.file_mtime_ms) {
      return right.file_mtime_ms - left.file_mtime_ms
    }
    return right.line_index - left.line_index
  })

  return {
    generated_at: new Date().toISOString(),
    services,
    entries: parsedEntries.slice(0, limit).map(
      ({
        sort_timestamp_ms: _sortTimestampMs,
        file_mtime_ms: _fileMtimeMs,
        line_index: _lineIndex,
        ...entry
      }) => entry,
    ),
  }
}
