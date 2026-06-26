export type SecurityLevel = 'public' | 'internal' | 'restricted' | 'confidential'
export type PublicationStatus = 'public' | 'internal' | 'confidential' | 'embargoed'
export type AiAccessPolicy = 'allow' | 'deny' | 'restricted' | 'review_required'

export interface DocumentSecurityFields {
  documentType?: string
  domain?: string
  securityLevel?: SecurityLevel
  publicationStatus?: PublicationStatus
  aiAccessPolicy?: AiAccessPolicy
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
    publicationStatus: string
    aiAccessPolicy: string
    domain: string
    domainMetadata: Record<string, unknown>
    documentType: string
    tags: string[]
  }
}

const SENSITIVE_DOMAINS = new Set(['exam', 'credential', 'payroll'])
const EXAM_PRACTICE_TYPES = new Set(['practice', 'study_guide', 'mock', 'drill'])
const EXAM_OFFICIAL_TYPES = new Set(['official', 'final', 'midterm'])
const EXAM_ANSWER_TYPES = new Set(['answer_key', 'answer', 'solution', 'dap_an'])
const EXAM_UPCOMING_STATUSES = new Set(['upcoming', 'active', 'scheduled', 'in_progress'])
const EXAM_SAFE_STATUSES = new Set(['completed', 'archived', 'published', 'past'])
const ADMIN_ROLES = new Set(['ADMIN', 'BGD', 'P2', 'P7'])

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

function defaultPublicationStatus(level: SecurityLevel): PublicationStatus {
  if (level === 'public') return 'public'
  if (level === 'confidential') return 'confidential'
  return 'internal'
}

function defaultAiAccessPolicy(level: SecurityLevel): AiAccessPolicy {
  if (level === 'confidential') return 'deny'
  if (level === 'restricted') return 'restricted'
  return 'allow'
}

const CATEGORY_SECURITY_DEFAULTS: Record<string, { domain: string; documentType: string }> = {
  'lịch thi': { domain: 'exam', documentType: 'exam' },
  'lich thi': { domain: 'exam', documentType: 'exam' },
  'tài liệu môn học': { domain: 'academic', documentType: 'course_material' },
  'tai lieu mon hoc': { domain: 'academic', documentType: 'course_material' },
}

function categoryDefaults(category: string): { domain: string; documentType: string } {
  const folded = clean(category).toLowerCase()
  return CATEGORY_SECURITY_DEFAULTS[folded] ?? { domain: 'general', documentType: 'document' }
}

export function documentRowToSecurityMeta(doc: Record<string, unknown>): DocumentSecurityFields {
  const category = clean(doc.category)
  const defaults = categoryDefaults(category)
  const securityLevel = (clean(doc.securityLevel) || 'internal') as SecurityLevel
  return {
    documentType: clean(doc.documentType) || defaults.documentType,
    domain: clean(doc.domain).toLowerCase() || defaults.domain,
    category,
    securityLevel,
    publicationStatus: (clean(doc.publicationStatus) ||
      defaultPublicationStatus(securityLevel)) as PublicationStatus,
    aiAccessPolicy: (clean(doc.aiAccessPolicy) ||
      defaultAiAccessPolicy(securityLevel)) as AiAccessPolicy,
    scopeType: clean(doc.scopeType) || 'all',
    accessRoleCodes: cleanList(doc.accessRoleCodes),
    tags: cleanList(doc.tags).map((tag) => tag.toLowerCase()),
    domainMetadata:
      doc.domainMetadata && typeof doc.domainMetadata === 'object'
        ? (doc.domainMetadata as Record<string, unknown>)
        : {},
    title: clean(doc.title),
  }
}

export function mergeChunkAndDocumentMetadata(
  chunkMeta: DocumentSecurityFields | Record<string, unknown>,
  documentMeta?: DocumentSecurityFields | Record<string, unknown>,
): DocumentSecurityFields {
  const docFields = documentRowToSecurityMeta((documentMeta ?? {}) as Record<string, unknown>)
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
      merged.documentType = merged.documentType || defaults.documentType
    }
  }
  if (merged.domain === 'exam') {
    const tags = new Set(merged.tags ?? [])
    tags.add('exam')
    merged.tags = [...tags]
  }
  return merged
}

function securityRank(level: SecurityLevel): number {
  return { public: 1, internal: 2, restricted: 3, confidential: 4 }[level] ?? 2
}

function isPrivileged(roles: string[]): boolean {
  return roles.some((role) => ADMIN_ROLES.has(role.toUpperCase()))
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
    const allowed = new Set(meta.accessDepartmentCodes ?? meta.allowedDepartments ?? [])
    return !!user.department && allowed.has(user.department)
  }
  if (scope === 'custom') {
    const allowed = new Set(meta.accessUserIds ?? meta.allowedUserIds ?? [])
    return !!user.userId && allowed.has(user.userId)
  }
  return false
}

function parseSecurityMeta(raw: DocumentSecurityFields): DocumentSecurityFields {
  const securityLevel = (clean(raw.securityLevel) || 'internal') as SecurityLevel
  const publicationStatus = (clean(raw.publicationStatus) ||
    defaultPublicationStatus(securityLevel)) as PublicationStatus
  const aiAccessPolicy = (clean(raw.aiAccessPolicy) ||
    defaultAiAccessPolicy(securityLevel)) as AiAccessPolicy
  const category = clean(raw.category)
  const defaults = categoryDefaults(category)
  let domain = clean(raw.domain).toLowerCase() || 'general'
  let documentType = clean(raw.documentType) || 'document'
  if (domain === 'general' && category) {
    domain = defaults.domain
    if (documentType === 'document') documentType = defaults.documentType
  }

  return {
    documentType,
    domain,
    category,
    securityLevel,
    publicationStatus,
    aiAccessPolicy,
    ownerUnit: clean(raw.ownerUnit),
    allowedRoles: cleanList(raw.allowedRoles ?? raw.accessRoleCodes),
    allowedDepartments: cleanList(raw.allowedDepartments ?? raw.accessDepartmentCodes),
    allowedUserIds: cleanList(raw.allowedUserIds ?? raw.accessUserIds),
    tags: cleanList(raw.tags).map((tag) => tag.toLowerCase()),
    domainMetadata:
      raw.domainMetadata && typeof raw.domainMetadata === 'object'
        ? raw.domainMetadata
        : {},
    scopeType: clean(raw.scopeType) || 'all',
    accessRoleCodes: cleanList(raw.accessRoleCodes ?? raw.allowedRoles),
    accessDepartmentCodes: cleanList(raw.accessDepartmentCodes ?? raw.allowedDepartments),
    accessUserIds: cleanList(raw.accessUserIds ?? raw.allowedUserIds),
    uploadedById: clean(raw.uploadedById),
    title: clean(raw.title),
  }
}

function details(meta: DocumentSecurityFields): DocumentSecurityDecision['details'] {
  return {
    securityLevel: meta.securityLevel ?? 'internal',
    publicationStatus: meta.publicationStatus ?? 'internal',
    aiAccessPolicy: meta.aiAccessPolicy ?? 'allow',
    domain: meta.domain ?? 'general',
    domainMetadata: meta.domainMetadata ?? {},
    documentType: meta.documentType ?? 'document',
    tags: meta.tags ?? [],
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

function examField(meta: DocumentSecurityFields, ...keys: string[]): string {
  const dm = meta.domainMetadata ?? {}
  for (const key of keys) {
    const value = clean(dm[key])
    if (value) return value.toLowerCase()
  }
  return ''
}

function evaluateExamDomain(meta: DocumentSecurityFields): DocumentSecurityDecision | null {
  const examType = examField(meta, 'examType', 'exam_type')
  const examStatus = examField(meta, 'examStatus', 'exam_status')
  const tags = new Set(meta.tags ?? [])

  if (EXAM_ANSWER_TYPES.has(examType) || tags.has('answer_key') || tags.has('dap_an')) {
    return deny(
      'exam-answer-leak',
      'Exam answer or solution content is not allowed for AI retrieval.',
      meta,
    )
  }

  if (EXAM_OFFICIAL_TYPES.has(examType) && EXAM_UPCOMING_STATUSES.has(examStatus)) {
    if (meta.publicationStatus === 'embargoed' || meta.publicationStatus === 'confidential') {
      return deny(
        'exam-official-embargoed',
        'Official upcoming exam with embargoed publication status.',
        meta,
      )
    }
    if (meta.publicationStatus !== 'public') {
      return deny(
        'exam-official-unpublished',
        'Official upcoming exam is not publicly published.',
        meta,
      )
    }
    if (meta.aiAccessPolicy === 'deny' || meta.aiAccessPolicy === 'review_required') {
      return deny(
        'exam-official-ai-deny',
        'Official upcoming exam is blocked by aiAccessPolicy.',
        meta,
      )
    }
  }

  if (EXAM_PRACTICE_TYPES.has(examType) || examType === 'study_guide') {
    if (meta.publicationStatus === 'embargoed' || meta.publicationStatus === 'confidential') {
      return deny(
        'exam-practice-unpublished',
        'Practice material is not published for AI access.',
        meta,
      )
    }
    if (meta.aiAccessPolicy === 'deny') {
      return deny(
        'exam-practice-ai-deny',
        'Practice material blocked by aiAccessPolicy.',
        meta,
      )
    }
    return null
  }

  if (EXAM_OFFICIAL_TYPES.has(examType) && EXAM_SAFE_STATUSES.has(examStatus)) {
    if (meta.publicationStatus === 'embargoed' || meta.publicationStatus === 'confidential') {
      return deny('exam-archive-embargoed', 'Archived exam remains embargoed.', meta)
    }
    return null
  }

  if (!examType || !examStatus) {
    return deny(
      'metadata-missing-exam',
      'Exam domain requires domainMetadata.examType and examStatus.',
      meta,
    )
  }

  if (meta.publicationStatus === 'embargoed' || meta.publicationStatus === 'confidential') {
    return deny(
      'exam-embargoed',
      'Exam document publication status blocks AI access.',
      meta,
    )
  }

  if (meta.aiAccessPolicy === 'deny' || meta.aiAccessPolicy === 'review_required') {
    return deny(
      'exam-unknown-ai-deny',
      'Unknown exam metadata with restrictive AI policy.',
      meta,
    )
  }

  return deny(
    'exam-unknown-type',
    'Exam document type/status is not approved for AI retrieval.',
    meta,
  )
}

function isSensitiveDocument(meta: DocumentSecurityFields): boolean {
  if (SENSITIVE_DOMAINS.has(meta.domain ?? '')) return true
  if (meta.documentType === 'exam' || meta.documentType === 'answer_key') return true
  if (categoryDefaults(meta.category ?? '').domain === 'exam') return true
  const tags = new Set(meta.tags ?? [])
  return tags.has('exam') || tags.has('answer_key') || tags.has('embargoed')
}

function checkAnswerLeak(meta: DocumentSecurityFields): DocumentSecurityDecision | null {
  let examType = examField(meta, 'examType', 'exam_type')
  const tags = new Set(meta.tags ?? [])
  if (meta.documentType === 'answer_key') examType = examType || 'answer_key'
  if (EXAM_ANSWER_TYPES.has(examType) || tags.has('answer_key') || tags.has('dap_an')) {
    return deny(
      'exam-answer-leak',
      'Exam answer or solution content is not allowed for AI retrieval.',
      meta,
    )
  }
  return null
}

export function evaluateDocumentSecurity(
  rawMeta: DocumentSecurityFields,
  user: PreviewUser,
): DocumentSecurityDecision {
  const meta = parseSecurityMeta(rawMeta)

  const leak = checkAnswerLeak(meta)
  if (leak) return leak

  if (meta.domain === 'exam') {
    const examDecision = evaluateExamDomain(meta)
    if (examDecision) return examDecision
  }

  if (meta.aiAccessPolicy === 'deny') {
    return deny('ai-access-deny', 'Document aiAccessPolicy is deny.', meta)
  }
  if (meta.aiAccessPolicy === 'review_required') {
    return deny(
      'ai-access-review-required',
      'Document requires manual review before AI access.',
      meta,
    )
  }

  if (meta.publicationStatus === 'embargoed' || meta.publicationStatus === 'confidential') {
    if (!isPrivileged(user.roles ?? [])) {
      return deny(
        'publication-embargoed',
        'Document publication status blocks AI retrieval.',
        meta,
      )
    }
  }

  if (isSensitiveDocument(meta)) {
    if (meta.domain === 'exam') {
      const examType = examField(meta, 'examType', 'exam_type')
      const examStatus = examField(meta, 'examStatus', 'exam_status')
      if (!examType || !examStatus) {
        return deny(
          'metadata-missing-sensitive',
          'Sensitive document is missing required domain metadata.',
          meta,
        )
      }
    }
  }

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
  'practice-public': {
    domain: 'exam',
    documentType: 'exam',
    securityLevel: 'public',
    publicationStatus: 'public',
    aiAccessPolicy: 'allow',
    scopeType: 'all',
    domainMetadata: { examType: 'practice', examStatus: 'upcoming' },
    tags: ['exam', 'practice'],
  },
  'official-upcoming': {
    domain: 'exam',
    documentType: 'exam',
    securityLevel: 'confidential',
    publicationStatus: 'embargoed',
    aiAccessPolicy: 'deny',
    scopeType: 'all',
    domainMetadata: { examType: 'official', examStatus: 'upcoming' },
    tags: ['exam'],
  },
  'answer-key': {
    domain: 'exam',
    documentType: 'answer_key',
    securityLevel: 'confidential',
    publicationStatus: 'confidential',
    aiAccessPolicy: 'deny',
    scopeType: 'all',
    domainMetadata: { examType: 'answer_key', examStatus: 'active' },
    tags: ['answer_key'],
  },
  'legacy-internal': {
    domain: 'general',
    documentType: 'document',
    securityLevel: 'internal',
    scopeType: 'all',
  },
  'legacy-exam-category': mergeChunkAndDocumentMetadata(
    { securityLevel: 'internal', scopeType: 'all', title: 'Đề thi cũ' },
    { category: 'Lịch thi' },
  ),
  'answer-key-tag-only': {
    domain: 'exam',
    documentType: 'exam',
    securityLevel: 'internal',
    publicationStatus: 'internal',
    aiAccessPolicy: 'allow',
    scopeType: 'all',
    tags: ['answer_key'],
    domainMetadata: {},
  },
  'chunk-fallback-practice': mergeChunkAndDocumentMetadata(
    {
      domainMetadata: { examType: 'practice', examStatus: 'upcoming' },
      publicationStatus: 'public',
      securityLevel: 'public',
      scopeType: 'all',
    },
    { category: 'Lịch thi', publicationStatus: 'internal' },
  ),
}
