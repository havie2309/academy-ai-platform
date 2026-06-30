export type SecurityLevel = 'public' | 'internal' | 'restricted' | 'confidential'

export interface DocumentSecurityFields {
  documentType?: string
  domain?: string
  securityLevel?: SecurityLevel
  publicationStatus?: string
  aiAccessPolicy?: string
  ownerUnit?: string
  allowedRoles?: string[]
  allowedDepartments?: string[]
  allowedUserIds?: string[]
  tags?: string[]
  domainMetadata?: Record<string, unknown>
  scopeType?: string
  accessRoleCodes?: string[]
  accessDepartmentCodes?: string[]
  accessUserIds?: string[]
  uploadedById?: string
  title?: string
  category?: string
}

export interface PreviewUser {
  userId?: string
  roles?: string[]
  department?: string | null
  maxSecurityLevel?: number
}

export interface DocumentSecurityDecision {
  allowed: boolean
  reason: string
  matchedRuleId: string | null
  details: {
    securityLevel: string
    scopeType: string
    domain: string
    documentType: string
    allowedRoles: string[]
    allowedDepartments: string[]
    allowedUserIds: string[]
  }
}

const ADMIN_ROLES = new Set(['ADMIN', 'BGD', 'P2', 'P7'])

const CATEGORY_SECURITY_DEFAULTS: Record<
  string,
  { domain: string; documentType: string }
> = {
  'lịch thi': { domain: 'exam', documentType: 'exam' },
  'lich thi': { domain: 'exam', documentType: 'exam' },
  'tài liệu môn học': { domain: 'academic', documentType: 'course_material' },
  'tai lieu mon hoc': { domain: 'academic', documentType: 'course_material' },
  'quy chế': { domain: 'regulation', documentType: 'regulation' },
  'quy che': { domain: 'regulation', documentType: 'regulation' },
}

function clean(value: unknown): string {
  return String(value ?? '').trim()
}

function cleanList(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const item = clean(value)
    if (!item || seen.has(item)) continue
    seen.add(item)
    out.push(item)
  }
  return out
}

function categoryDefaults(category: string): {
  domain: string
  documentType: string
} {
  const folded = clean(category).toLowerCase()
  return (
    CATEGORY_SECURITY_DEFAULTS[folded] ?? {
      domain: 'general',
      documentType: 'document',
    }
  )
}

function securityRank(level: SecurityLevel): number {
  return { public: 1, internal: 2, restricted: 3, confidential: 4 }[level] ?? 2
}

function isPrivileged(roles: string[]): boolean {
  return roles.some((role) => ADMIN_ROLES.has(clean(role).toUpperCase()))
}

export function documentRowToSecurityMeta(
  doc: Record<string, unknown>,
): DocumentSecurityFields {
  const category = clean(doc.category)
  const defaults = categoryDefaults(category)
  const securityLevel = (clean(doc.securityLevel) || 'internal') as SecurityLevel
  const scopeType = clean(doc.scopeType) || 'all'

  return {
    documentType: clean(doc.documentType) || defaults.documentType,
    domain: clean(doc.domain).toLowerCase() || defaults.domain,
    category,
    securityLevel,
    publicationStatus: clean(doc.publicationStatus) || undefined,
    aiAccessPolicy: clean(doc.aiAccessPolicy) || undefined,
    ownerUnit: clean(doc.ownerUnit) || undefined,
    allowedRoles: cleanList(doc.allowedRoles ?? doc.accessRoleCodes),
    allowedDepartments: cleanList(
      doc.allowedDepartments ?? doc.accessDepartmentCodes,
    ),
    allowedUserIds: cleanList(doc.allowedUserIds ?? doc.accessUserIds),
    tags: cleanList(doc.tags).map((tag) => tag.toLowerCase()),
    domainMetadata:
      doc.domainMetadata && typeof doc.domainMetadata === 'object'
        ? (doc.domainMetadata as Record<string, unknown>)
        : {},
    scopeType,
    accessRoleCodes: cleanList(doc.accessRoleCodes ?? doc.allowedRoles),
    accessDepartmentCodes: cleanList(
      doc.accessDepartmentCodes ?? doc.allowedDepartments,
    ),
    accessUserIds: cleanList(doc.accessUserIds ?? doc.allowedUserIds),
    uploadedById: clean(doc.uploadedById),
    title: clean(doc.title),
  }
}

export function mergeChunkAndDocumentMetadata(
  chunkMeta: DocumentSecurityFields | Record<string, unknown>,
  documentMeta?: DocumentSecurityFields | Record<string, unknown>,
): DocumentSecurityFields {
  const docFields = documentRowToSecurityMeta(
    (documentMeta ?? {}) as Record<string, unknown>,
  )
  const merged: DocumentSecurityFields = { ...docFields }

  for (const [key, value] of Object.entries(chunkMeta ?? {})) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    ;(merged as Record<string, unknown>)[key] = value
  }

  const category = clean(merged.category || docFields.category)
  if (category) {
    merged.category = category
    const defaults = categoryDefaults(category)
    if (!merged.domain || merged.domain === 'general') {
      merged.domain = defaults.domain
      merged.documentType = clean(merged.documentType) || defaults.documentType
    }
  }

  return merged
}

function parseSecurityMeta(raw: DocumentSecurityFields): DocumentSecurityFields {
  const category = clean(raw.category)
  const defaults = categoryDefaults(category)
  const securityLevel = (clean(raw.securityLevel) || 'internal') as SecurityLevel
  const scopeType = clean(raw.scopeType) || 'all'
  const domain = clean(raw.domain).toLowerCase() || defaults.domain
  const documentType = clean(raw.documentType) || defaults.documentType

  return {
    ...raw,
    category,
    securityLevel,
    scopeType,
    domain,
    documentType,
    allowedRoles: cleanList(raw.allowedRoles ?? raw.accessRoleCodes),
    allowedDepartments: cleanList(
      raw.allowedDepartments ?? raw.accessDepartmentCodes,
    ),
    allowedUserIds: cleanList(raw.allowedUserIds ?? raw.accessUserIds),
    accessRoleCodes: cleanList(raw.accessRoleCodes ?? raw.allowedRoles),
    accessDepartmentCodes: cleanList(
      raw.accessDepartmentCodes ?? raw.allowedDepartments,
    ),
    accessUserIds: cleanList(raw.accessUserIds ?? raw.allowedUserIds),
    uploadedById: clean(raw.uploadedById),
  }
}

function canViewChunk(meta: DocumentSecurityFields, user: PreviewUser): boolean {
  if (meta.uploadedById && meta.uploadedById === user.userId) return true

  const roles = user.roles ?? []
  if (isPrivileged(roles)) return true

  const level = (meta.securityLevel ?? 'internal') as SecurityLevel
  if (securityRank(level) > (user.maxSecurityLevel ?? 1)) return false

  const scope = meta.scopeType ?? 'all'
  if (scope === 'all') return true

  if (scope === 'role') {
    const allowed = new Set(meta.accessRoleCodes ?? meta.allowedRoles ?? [])
    return roles.some((role) => allowed.has(role))
  }

  if (scope === 'department') {
    const allowed = new Set(
      meta.accessDepartmentCodes ?? meta.allowedDepartments ?? [],
    )
    return !!user.department && allowed.has(user.department)
  }

  if (scope === 'custom') {
    const allowed = new Set(meta.accessUserIds ?? meta.allowedUserIds ?? [])
    return !!user.userId && allowed.has(user.userId)
  }

  return false
}

function details(meta: DocumentSecurityFields): DocumentSecurityDecision['details'] {
  return {
    securityLevel: meta.securityLevel ?? 'internal',
    scopeType: meta.scopeType ?? 'all',
    domain: meta.domain ?? 'general',
    documentType: meta.documentType ?? 'document',
    allowedRoles: meta.accessRoleCodes ?? meta.allowedRoles ?? [],
    allowedDepartments:
      meta.accessDepartmentCodes ?? meta.allowedDepartments ?? [],
    allowedUserIds: meta.accessUserIds ?? meta.allowedUserIds ?? [],
  }
}

function deny(
  ruleId: string,
  reason: string,
  meta: DocumentSecurityFields,
): DocumentSecurityDecision {
  return {
    allowed: false,
    reason,
    matchedRuleId: ruleId,
    details: details(meta),
  }
}

function allow(meta: DocumentSecurityFields): DocumentSecurityDecision {
  return {
    allowed: true,
    reason: 'allowed',
    matchedRuleId: null,
    details: details(meta),
  }
}

export function evaluateDocumentSecurity(
  rawMeta: DocumentSecurityFields,
  user: PreviewUser,
): DocumentSecurityDecision {
  const meta = parseSecurityMeta(rawMeta)

  if (!canViewChunk(meta, user)) {
    return deny(
      'acl-insufficient',
      'User lacks permission for document security level or scope.',
      meta,
    )
  }

  return allow(meta)
}

export const DOCUMENT_SECURITY_PRESETS: Record<string, DocumentSecurityFields> = {
  'student-internal-all': {
    domain: 'general',
    documentType: 'document',
    securityLevel: 'internal',
    scopeType: 'all',
    title: 'Thông báo nội bộ',
  },
  'teacher-role-restricted': {
    domain: 'academic',
    documentType: 'course_material',
    securityLevel: 'restricted',
    scopeType: 'role',
    accessRoleCodes: ['GIANG_VIEN'],
    title: 'Tài liệu giảng viên',
  },
  'department-cntt': {
    domain: 'academic',
    documentType: 'course_material',
    securityLevel: 'internal',
    scopeType: 'department',
    accessDepartmentCodes: ['CNTT'],
    title: 'Tài liệu đơn vị CNTT',
  },
  'custom-user-only': {
    domain: 'general',
    documentType: 'document',
    securityLevel: 'internal',
    scopeType: 'custom',
    accessUserIds: ['USR999'],
    title: 'Tài liệu cá nhân',
  },
  'confidential-admin-only': {
    domain: 'regulation',
    documentType: 'regulation',
    securityLevel: 'confidential',
    scopeType: 'role',
    accessRoleCodes: ['ADMIN', 'BGD', 'P2'],
    title: 'Quy chế mật',
  },
  'legacy-internal': {
    domain: 'general',
    documentType: 'document',
    securityLevel: 'internal',
    scopeType: 'all',
    title: 'Tài liệu legacy',
  },
}
