import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  History,
  LayoutDashboard,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Plus,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react'
import {
  adminApi,
  fetchGatewayHealth,
  type AdminOpsOverview,
  type AuditLogEntry,
  type GuardrailMatchMode,
  type GuardrailRule,
  type GatewayHealth,
  type RagPolicyConfig,
  type StoredAdminConfig,
} from '../api/admin'
import { authApi } from '../api/auth'
import AdminAuditSection from '../components/admin/AdminAuditSection'
import AdminOpsSection from '../components/admin/AdminOpsSection'
import AdminTechnicalDetails from '../components/admin/AdminTechnicalDetails'
import { formatRoleLabel, normalizeRoles } from '../lib/authz'
import {
  previewGuardrailMatch,
  previewLayerLabel,
} from '../lib/guardrailPreview'
import {
  DOCUMENT_SECURITY_PRESETS,
  evaluateDocumentSecurity,
  mergeChunkAndDocumentMetadata,
} from '../lib/documentSecurity'
import {
  MATCH_MODE_OPTIONS,
  countActivePhrases,
  createGuardrailRule,
  defaultGuardrailRule,
  linesFromList,
  matchModeLabel,
  normalizeGuardrailRules,
  parseLineList,
  rulesAreEqual,
} from '../lib/guardrailRules'

type UpstreamKey = keyof GatewayHealth['upstream']
type AdminTab = 'operations' | 'users' | 'policy' | 'technical'

const SERVICE_META: Array<{
  key: UpstreamKey
  label: string
  description: string
  technicalName: string
}> = [
  {
    key: 'userManagement',
    label: 'Quản lý người dùng',
    description: 'Đăng nhập, hồ sơ người dùng và phiên làm việc.',
    technicalName: 'userManagement',
  },
  {
    key: 'chat',
    label: 'Hỏi đáp',
    description: 'Phiên trò chuyện và lịch sử trao đổi.',
    technicalName: 'chat',
  },
  {
    key: 'rbac',
    label: 'Phân quyền',
    description: 'Vai trò, phạm vi truy cập và kiểm soát quyền.',
    technicalName: 'rbac',
  },
  {
    key: 'adminConfig',
    label: 'Chính sách AI',
    description: 'Lưu cấu hình an toàn và nội dung phản hồi.',
    technicalName: 'adminConfig',
  },
  {
    key: 'audit',
    label: 'Nhật ký kiểm toán',
    description: 'Theo dõi thay đổi và hoạt động quản trị.',
    technicalName: 'audit',
  },
  {
    key: 'rag',
    label: 'Trợ lý AI tra cứu',
    description: 'Tra cứu tài liệu, trích dẫn và điều phối câu trả lời.',
    technicalName: 'rag',
  },
]

const ADMIN_TABS = [
  {
    key: 'operations' as const,
    label: 'Kiểm tra hoạt động',
    icon: LayoutDashboard,
    description: 'Snapshot nhanh về tình trạng hệ thống, user cần xử lý và lỗi bị chặn gần đây.',
  },
  {
    key: 'users' as const,
    label: 'Danh sách người dùng',
    icon: UserCog,
    description: 'Tìm kiếm, lọc và thao tác trực tiếp trên tài khoản người dùng.',
  },
  {
    key: 'policy' as const,
    label: 'Chính sách AI',
    icon: Bot,
    description: 'Quản lý nhóm rule chặn, từ đồng nghĩa và kiểm tra thử câu hỏi.',
  },
  {
    key: 'technical' as const,
    label: 'Nhật ký Kỹ thuật',
    icon: History,
    description: 'Toàn bộ GET/POST/PATCH/DELETE, mã HTTP, route raw và các panel kỹ thuật.',
  },
]

function hydrateForm(
  config: StoredAdminConfig<RagPolicyConfig>,
  setEnabled: (value: boolean) => void,
  setDraftRules: (value: GuardrailRule[]) => void,
  setSafeRefusal: (value: string) => void,
  setReason: (value: string) => void,
) {
  setEnabled(config.value.enabled)
  setDraftRules(normalizeGuardrailRules(config.value.guardrailRules))
  setSafeRefusal(config.value.safeRefusalMessage)
  setReason('')
}

function updateDraftRule(
  rules: GuardrailRule[],
  index: number,
  patch: Partial<GuardrailRule>,
): GuardrailRule[] {
  return rules.map((rule, ruleIndex) =>
    ruleIndex === index ? { ...rule, ...patch } : rule,
  )
}
function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Chưa cập nhật'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('vi-VN')
}

function serviceStatusLabel(status: 'up' | 'down'): string {
  return status === 'up' ? 'Hoạt động' : 'Cần kiểm tra'
}

function systemStatusLabel(status: string | undefined): string {
  return status === 'ok'
    ? 'Hệ thống hoạt động bình thường'
    : 'Cần kiểm tra'
}

function statusTone(status: 'up' | 'down') {
  return status === 'up'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-amber-200 bg-amber-50 text-amber-700'
}

function auditStatusLabel(status: AuditLogEntry['status']): string {
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

function auditStatusTone(status: AuditLogEntry['status']): string {
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

function humanizeError(message: string, area: string): {
  summary: string
  technical: string | null
} {
  const normalized = message.trim()
  if (!normalized) {
    return {
      summary: `${area} hiện chưa sẵn sàng.`,
      technical: null,
    }
  }

  if (normalized.includes('504')) {
    return {
      summary: `${area} đang gặp lỗi kết nối dịch vụ.`,
      technical: normalized,
    }
  }

  if (normalized.includes('503')) {
    return {
      summary: `${area} đang tạm thời quá tải hoặc chưa sẵn sàng.`,
      technical: normalized,
    }
  }

  if (normalized.includes('401')) {
    return {
      summary: `${area} cần đăng nhập lại để tiếp tục.`,
      technical: normalized,
    }
  }

  return {
    summary: normalized.replace('Lỗi API', 'Lỗi kết nối dịch vụ'),
    technical: normalized,
  }
}

function humanizeAuditAction(action: string): string {
  const labels: Record<string, string> = {
    get: 'GET',
    post: 'POST',
    put: 'PUT',
    patch: 'PATCH',
    delete: 'DELETE',
    'policy.update': 'Cập nhật chính sách AI',
    'account.lock': 'Khóa tài khoản',
    'account.unlock': 'Mở khóa tài khoản',
    'account.activate': 'Kích hoạt tài khoản',
    'account.inactivate': 'Tạm ngưng tài khoản',
    'session.revoke': 'Thu hồi đăng nhập',
    'auth.login': 'Đăng nhập',
    'auth.logout': 'Đăng xuất',
  }

  if (labels[action]) return labels[action]

  return action
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ')
}

function extractAuditHttpMeta(log: AuditLogEntry): {
  method: string | null
  route: string | null
  statusCode: number | null
} {
  let method: string | null = null
  let route: string | null = null
  let statusCode: number | null = null

  if (log.new_value && typeof log.new_value === 'object' && !Array.isArray(log.new_value)) {
    const payload = log.new_value as Record<string, unknown>
    if (typeof payload.method === 'string' && payload.method.trim()) {
      method = payload.method.trim().toUpperCase()
    }
    if (typeof payload.path === 'string' && payload.path.trim()) {
      route = payload.path.trim()
    }
    if (typeof payload.statusCode === 'number' && Number.isFinite(payload.statusCode)) {
      statusCode = payload.statusCode
    } else if (typeof payload.statusCode === 'string' && payload.statusCode.trim()) {
      const parsed = Number(payload.statusCode)
      if (Number.isFinite(parsed)) statusCode = parsed
    }
  }

  const actionMethod = log.action.trim().toUpperCase()
  if (
    !method &&
    ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(actionMethod)
  ) {
    method = actionMethod
  }

  if (statusCode == null && typeof log.reason === 'string') {
    const matched = log.reason.match(/HTTP\s+(\d{3})/i)
    if (matched) {
      const parsed = Number(matched[1])
      if (Number.isFinite(parsed)) statusCode = parsed
    }
  }

  return { method, route, statusCode }
}


export default function AdminPage() {
  const user = authApi.getUser()
  const normalizedRoles = normalizeRoles(user?.roles)
  const roleLabels = useMemo(() => {
    const seen = new Set<string>()
    return normalizedRoles
      .map((role) => formatRoleLabel(role))
      .filter((label) => {
        const key = label.trim().toLowerCase()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
  }, [normalizedRoles])
  const usernameLabel = user?.username?.trim() || 'ẩn danh'
  const showUsernameBadge =
    usernameLabel === 'ẩn danh' ||
    !roleLabels.some(
      (label) => label.trim().toLowerCase() === usernameLabel.toLowerCase(),
    )

  const [activeTab, setActiveTab] = useState<AdminTab>('operations')

  const [health, setHealth] = useState<GatewayHealth | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [healthError, setHealthError] = useState<string | null>(null)

  const [policy, setPolicy] =
    useState<StoredAdminConfig<RagPolicyConfig> | null>(null)
  const [policyLoading, setPolicyLoading] = useState(true)
  const [policyError, setPolicyError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [opsOverview, setOpsOverview] = useState<AdminOpsOverview | null>(null)
  const [opsOverviewLoading, setOpsOverviewLoading] = useState(true)
  const [opsOverviewError, setOpsOverviewError] = useState<string | null>(null)

  const [recentIncidents, setRecentIncidents] = useState<AuditLogEntry[]>([])
  const [recentIncidentsLoading, setRecentIncidentsLoading] = useState(true)
  const [recentIncidentsError, setRecentIncidentsError] = useState<string | null>(
    null,
  )

  const [enabled, setEnabled] = useState(true)
  const [draftRules, setDraftRules] = useState<GuardrailRule[]>([defaultGuardrailRule()])
  const [safeRefusalMessage, setSafeRefusalMessage] = useState('')
  const [reason, setReason] = useState('')
  const [policyPreviewText, setPolicyPreviewText] = useState('')
  const [docSecurityPreset, setDocSecurityPreset] =
    useState<keyof typeof DOCUMENT_SECURITY_PRESETS | 'custom'>('practice-public')
  const [docSecurityCustomJson, setDocSecurityCustomJson] = useState(
    JSON.stringify(DOCUMENT_SECURITY_PRESETS['practice-public'], null, 2),
  )

  const loadHealth = async () => {
    setHealthLoading(true)
    setHealthError(null)
    try {
      const nextHealth = await fetchGatewayHealth()
      if (!nextHealth) {
        throw new Error('Không tải được trạng thái hệ thống từ API gateway.')
      }
      setHealth(nextHealth)
    } catch (error) {
      setHealthError(
        error instanceof Error
          ? error.message
          : 'Không tải được trạng thái hệ thống.',
      )
    } finally {
      setHealthLoading(false)
    }
  }

  const loadPolicy = async () => {
    setPolicyLoading(true)
    setPolicyError(null)
    try {
      const nextPolicy = await adminApi.getRagPolicy()
      setPolicy(nextPolicy)
      hydrateForm(
        nextPolicy,
        setEnabled,
        setDraftRules,
        setSafeRefusalMessage,
        setReason,
      )
    } catch (error) {
      setPolicyError(
        error instanceof Error
          ? error.message
          : 'Không tải được chính sách an toàn AI.',
      )
    } finally {
      setPolicyLoading(false)
    }
  }

  const loadOpsOverview = async () => {
    setOpsOverviewLoading(true)
    setOpsOverviewError(null)
    try {
      setOpsOverview(await adminApi.getOpsOverview())
    } catch (error) {
      setOpsOverviewError(
        error instanceof Error
          ? error.message
          : 'Không tải được snapshot quản trị tài khoản.',
      )
    } finally {
      setOpsOverviewLoading(false)
    }
  }

  const loadRecentIncidents = async () => {
    setRecentIncidentsLoading(true)
    setRecentIncidentsError(null)
    try {
      const logs = await adminApi.getAuditLogs({ limit: 40 })
      setRecentIncidents(logs.filter((log) => log.status !== 'success').slice(0, 8))
    } catch (error) {
      setRecentIncidentsError(
        error instanceof Error
          ? error.message
          : 'Không tải được lỗi hoặc bản ghi bị chặn gần đây.',
      )
    } finally {
      setRecentIncidentsLoading(false)
    }
  }

  useEffect(() => {
    void loadHealth()
    void loadPolicy()
    void loadOpsOverview()
    void loadRecentIncidents()
  }, [])

  const normalizedDraftRules = useMemo(
    () => normalizeGuardrailRules(draftRules),
    [draftRules],
  )
  const previewMatch = useMemo(
    () => previewGuardrailMatch(policyPreviewText, normalizedDraftRules, { enabled }),
    [policyPreviewText, normalizedDraftRules, enabled],
  )
  const docSecurityPreviewMeta = useMemo(() => {
    if (docSecurityPreset !== 'custom') {
      return DOCUMENT_SECURITY_PRESETS[docSecurityPreset]
    }
    try {
      const parsed = JSON.parse(docSecurityCustomJson) as Record<string, unknown>
      return mergeChunkAndDocumentMetadata(
        (parsed.chunkMetadata as Record<string, unknown>) ?? parsed,
        (parsed.documentMetadata as Record<string, unknown>) ??
          (parsed.category ? { category: parsed.category } : undefined),
      )
    } catch {
      return DOCUMENT_SECURITY_PRESETS['practice-public']
    }
  }, [docSecurityPreset, docSecurityCustomJson])

  const docSecurityCustomError = useMemo(() => {
    if (docSecurityPreset !== 'custom') return null
    try {
      JSON.parse(docSecurityCustomJson)
      return null
    } catch {
      return 'JSON metadata không hợp lệ.'
    }
  }, [docSecurityPreset, docSecurityCustomJson])

  const docSecurityDecision = useMemo(
    () =>
      evaluateDocumentSecurity(docSecurityPreviewMeta, {
        userId: 'preview-student',
        roles: ['HOC_VIEN'],
        department: 'CNTT',
        maxSecurityLevel: 2,
      }),
    [docSecurityPreviewMeta],
  )

  const healthyServices = SERVICE_META.filter(
    (service) => health?.upstream[service.key] === 'up',
  ).length
  const degradedServices = SERVICE_META.length - healthyServices
  const policyVersion = policy?.version ?? 0
  const lastUpdated = formatTimestamp(policy?.updated_at)
  const policyFormDisabled = policyLoading || saving || !policy

  const accountsNeedingAttention = opsOverview
    ? opsOverview.account_summary.locked_users +
      opsOverview.account_summary.temporary_locked_users
    : 0
  const suspendedOrLockedAccounts = opsOverview
    ? opsOverview.account_summary.inactive_users +
      opsOverview.account_summary.locked_users
    : 0
  const recentIncidentCount = recentIncidents.length

  const isDirty =
    !!policy &&
    (enabled !== policy.value.enabled ||
      safeRefusalMessage.trim() !== policy.value.safeRefusalMessage ||
      !rulesAreEqual(normalizedDraftRules, policy.value.guardrailRules) ||
      !!reason.trim())

  const policyPreviewBlocked = !policyLoading && !!previewMatch

  const savePolicy = async () => {
    if (!policy) return
    setSaving(true)
    setSaveMessage(null)
    setPolicyError(null)
    try {
      const updated = await adminApi.updateRagPolicy({
        enabled,
        guardrailRules: normalizedDraftRules,
        safeRefusalMessage: safeRefusalMessage.trim(),
        reason: reason.trim(),
      })
      setPolicy(updated)
      hydrateForm(
        updated,
        setEnabled,
        setDraftRules,
        setSafeRefusalMessage,
        setReason,
      )
      setSaveMessage('Đã lưu chính sách an toàn AI thành công.')
    } catch (error) {
      setPolicyError(
        error instanceof Error
          ? error.message
          : 'Không lưu được chính sách an toàn AI.',
      )
    } finally {
      setSaving(false)
    }
  }

  const resetPolicy = () => {
    if (!policy) return
    hydrateForm(
      policy,
      setEnabled,
      setDraftRules,
      setSafeRefusalMessage,
      setReason,
    )
    setPolicyPreviewText('')
    setSaveMessage(null)
    setPolicyError(null)
  }

  const reloadAll = () => {
    void loadHealth()
    void loadPolicy()
    void loadOpsOverview()
    void loadRecentIncidents()
  }

  const healthNotice = healthError
    ? humanizeError(healthError, 'Trạng thái hệ thống')
    : null
  const policyNotice = policyError
    ? humanizeError(policyError, 'Chính sách an toàn AI')
    : null
  const opsOverviewNotice = opsOverviewError
    ? humanizeError(opsOverviewError, 'Snapshot tài khoản')
    : null
  const incidentsNotice = recentIncidentsError
    ? humanizeError(recentIncidentsError, 'Nhật ký lỗi gần đây')
    : null

  return (
    <div
      className="flex h-full flex-col overflow-y-auto bg-slate-50/60 p-6 md:p-8 [&_.text-2xl]:!text-xl [&_.text-lg]:!text-base [&_.text-sm]:!text-[13px] [&_.text-xs]:!text-[11px]"
      data-testid="admin-page"
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-4xl">
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-800">
            <LayoutDashboard className="text-blue-600" />
            Bảng điều khiển vận hành quản trị
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            {roleLabels.map((label) => (
              <span
                key={label}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
              >
                {label}
              </span>
            ))}
            {showUsernameBadge && (
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                {usernameLabel}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reloadAll}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
          >
            <RefreshCw size={16} />
            Tải lại dữ liệu
          </button>
        </div>
      </div>

      {(healthNotice || policyNotice || saveMessage) && (
        <div className="mt-5 space-y-3">
          {healthNotice && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 shrink-0" size={16} />
                <div className="min-w-0 flex-1">
                  <p>{healthNotice.summary}</p>
                  {healthNotice.technical &&
                    healthNotice.technical !== healthNotice.summary && (
                      <div className="mt-2">
                        <AdminTechnicalDetails
                          title="Chi tiết kỹ thuật"
                          description="Mã lỗi gốc và thông tin hỗ trợ kiểm tra."
                        >
                          <p className="text-sm text-slate-700">
                            {healthNotice.technical}
                          </p>
                        </AdminTechnicalDetails>
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}

          {policyNotice && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 shrink-0" size={16} />
                <div className="min-w-0 flex-1">
                  <p>{policyNotice.summary}</p>
                  {policyNotice.technical &&
                    policyNotice.technical !== policyNotice.summary && (
                      <div className="mt-2">
                        <AdminTechnicalDetails
                          title="Chi tiết kỹ thuật"
                          description="Mã lỗi gốc và thông tin hỗ trợ kiểm tra."
                        >
                          <p className="text-sm text-slate-700">
                            {policyNotice.technical}
                          </p>
                        </AdminTechnicalDetails>
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}

          {saveMessage && (
            <div
              className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              data-testid="policy-save-message"
            >
              <CheckCircle2 className="mt-0.5 shrink-0" size={16} />
              <span>{saveMessage}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 rounded-3xl border border-slate-200/70 bg-white p-2 shadow-sm">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                data-testid={`admin-tab-${tab.key}`}
                className={`rounded-2xl px-4 py-4 text-left transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/15'
                    : 'bg-slate-50/70 text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`rounded-xl p-2 ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'bg-white text-blue-600 shadow-sm'
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{tab.label}</p>
                    <p
                      className={`mt-1 text-xs leading-relaxed ${
                        isActive ? 'text-blue-100' : 'text-slate-500'
                      }`}
                    >
                      {tab.description}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {activeTab === 'operations' && (
        <>
          {(opsOverviewNotice || incidentsNotice) && (
            <div className="mt-5 space-y-3">
              {[opsOverviewNotice, incidentsNotice]
                .filter(Boolean)
                .map((notice) => (
                  <div
                    key={notice?.summary}
                    className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 shrink-0" size={16} />
                      <div className="min-w-0 flex-1">
                        <p>{notice?.summary}</p>
                        {notice?.technical &&
                          notice.technical !== notice.summary && (
                            <div className="mt-2 text-xs text-amber-700">
                              {notice.technical}
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Trạng thái hệ thống
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-800">
                    {healthLoading ? '...' : systemStatusLabel(health?.status)}
                  </p>
                </div>
                <div
                  className={`rounded-xl p-2 ${
                    health?.status === 'ok'
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  {health?.status === 'ok' ? (
                    <ShieldCheck size={18} />
                  ) : (
                    <ShieldAlert size={18} />
                  )}
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                {health?.status === 'ok'
                  ? 'Các dịch vụ chính đang phản hồi bình thường.'
                  : 'Có dịch vụ cần kiểm tra thêm trước khi xử lý các tác vụ quản trị.'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Dịch vụ đang ổn
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-800">
                {healthLoading ? '...' : `${healthyServices}/${SERVICE_META.length}`}
              </p>
              <p className="mt-3 text-sm text-slate-500">
                Hoạt động tốt: {healthyServices}. Cần kiểm tra: {degradedServices}.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Tài khoản cần xử lý
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-800">
                {opsOverviewLoading ? '...' : accountsNeedingAttention}
              </p>
              <p className="mt-3 text-sm text-slate-500">
                Đã khóa / tạm khóa đăng nhập: {opsOverview?.account_summary.locked_users ?? 0} /{' '}
                {opsOverview?.account_summary.temporary_locked_users ?? 0}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Lỗi hoặc bị chặn gần đây
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-800">
                {recentIncidentsLoading ? '...' : recentIncidentCount}
              </p>
              <p className="mt-3 text-sm text-slate-500">
                Chỉ hiển thị bản ghi thất bại hoặc bị chặn; đã ẩn GET thành công thông thường.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Chính sách AI
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-800">
                {policyLoading ? '...' : enabled ? 'Đang bật' : 'Đang tắt'}
              </p>
              <p className="mt-3 text-sm text-slate-500">
                {policyLoading
                  ? 'Đang tải trạng thái chính sách.'
                  : `Nhóm rule đang áp dụng: ${normalizedDraftRules.length}, cụm từ: ${countActivePhrases(normalizedDraftRules)}.`}
              </p>
            </div>
          </section>

          <section className="mt-6">
            <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                    <Server className="text-blue-600" size={18} />
                    Card trạng thái hệ thống
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Tình trạng các dịch vụ chính đang phục vụ dashboard quản trị.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadHealth()}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white"
                >
                  <RefreshCw size={15} />
                  Làm mới trạng thái
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {SERVICE_META.map((service) => {
                  const status = health?.upstream[service.key] ?? 'down'
                  return (
                    <article
                      key={service.key}
                      data-testid={`health-card-${service.key}`}
                      className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">
                            {service.label}
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">
                            {service.description}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusTone(
                            status,
                          )}`}
                        >
                          {healthLoading ? '...' : serviceStatusLabel(status)}
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>

            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                  <History className="text-blue-600" size={18} />
                  Lỗi và bị chặn gần đây
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Chỉ tập trung vào bản ghi thất bại hoặc bị chặn gần đây, không hiện GET thành công thường.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadRecentIncidents()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white"
              >
                <RefreshCw size={15} />
                Tải lại lỗi gần đây
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {recentIncidentsLoading && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-500">
                  Đang tải lỗi và bản ghi bị chặn gần đây...
                </div>
              )}

              {!recentIncidentsLoading && recentIncidents.length === 0 && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                  Hiện chưa có lỗi hoặc bản ghi bị chặn nào gần đây.
                </div>
              )}

              {!recentIncidentsLoading &&
                recentIncidents.map((log) => {
                  const httpMeta = extractAuditHttpMeta(log)
                  return (
                    <article
                      key={log.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${auditStatusTone(
                                log.status,
                              )}`}
                            >
                              {auditStatusLabel(log.status)}
                            </span>
                            {httpMeta.method && (
                              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-700">
                                {httpMeta.method}
                              </span>
                            )}
                          </div>
                          <p className="mt-3 font-semibold text-slate-800">
                            {httpMeta.route
                              ? `${httpMeta.route}`
                              : humanizeAuditAction(log.action)}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {log.reason ?? 'Không có ghi chú bổ sung.'}
                          </p>
                          <p className="mt-2 text-xs text-slate-400">
                            {log.user_id ?? 'Hệ thống'} ·{' '}
                            {httpMeta.statusCode != null
                              ? `HTTP ${httpMeta.statusCode}`
                              : 'Chưa có mã HTTP'}
                          </p>
                        </div>
                        <div className="shrink-0 text-xs font-semibold text-slate-500">
                          {formatTimestamp(log.created_at)}
                        </div>
                      </div>
                    </article>
                  )
                })}
            </div>
          </section>
        </>
      )}

      {activeTab === 'users' && (
        <>
          <section className="mt-6 rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <Users className="text-blue-600" size={18} />
              Tài khoản cần xử lý
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Các tài khoản cần can thiệp nhanh được gom về tab danh sách người dùng để theo dõi
              và thao tác liền mạch hơn.
            </p>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Tài khoản bị khóa hoặc tạm ngưng
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-800">
                  {opsOverviewLoading ? '...' : suspendedOrLockedAccounts}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Tạm ngưng: {opsOverview?.account_summary.inactive_users ?? 0} · Đã khóa:{' '}
                  {opsOverview?.account_summary.locked_users ?? 0}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Phiên đăng nhập đang mở
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-800">
                  {opsOverviewLoading
                    ? '...'
                    : opsOverview?.token_summary.active_refresh_sessions ?? 0}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Sắp hết hạn 24h: {opsOverview?.token_summary.sessions_expiring_24h ?? 0}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Đăng nhập cần kiểm tra
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-800">
                  {opsOverviewLoading
                    ? '...'
                    : opsOverview?.usage_summary.failed_logins_24h ?? 0}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Thành công 24h: {opsOverview?.usage_summary.successful_logins_24h ?? 0}
                </p>
              </div>
            </div>
          </section>

          <AdminOpsSection showSummaryCards={false} showTechnical={false} />
        </>
      )}

      {activeTab === 'policy' && (
        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
          <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                  <Bot className="text-blue-600" size={18} />
                  Chính sách AI
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Bật hoặc tắt chặn câu hỏi nhạy cảm, quản lý từng nhóm rule và điều chỉnh câu trả lời hiển thị cho người dùng.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadPolicy()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white"
              >
                <RefreshCw size={15} />
                Tải lại chính sách
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <label className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                <div>
                  <span className="text-sm font-semibold text-slate-800">
                    Bật chặn câu hỏi nhạy cảm
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Khi bật, hệ thống sẽ chặn những yêu cầu thuộc danh sách không an toàn trước khi gửi sang trợ lý AI.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                  data-testid="policy-enabled-toggle"
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  aria-label="Bật chặn câu hỏi nhạy cảm"
                  disabled={policyFormDisabled}
                />
              </label>

              <div className="space-y-4" data-testid="policy-rule-list">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      Nhóm rule chặn
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Mỗi nhóm có cụm từ chính và chế độ khớp riêng; synonym được tự sinh khi lưu.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftRules((rules) => [...rules, createGuardrailRule(rules.length)])
                    }
                    disabled={policyFormDisabled}
                    data-testid="policy-add-rule"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    <Plus size={15} />
                    Thêm nhóm
                  </button>
                </div>

                {draftRules.map((rule, index) => (
                  <div
                    key={`${rule.id}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                    data-testid={`policy-rule-${index}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-[220px] flex-1 space-y-3">
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Tên nhóm
                          </span>
                          <input
                            value={rule.label}
                            onChange={(event) =>
                              setDraftRules((rules) =>
                                updateDraftRule(rules, index, { label: event.target.value }),
                              )
                            }
                            disabled={policyFormDisabled}
                            data-testid={`policy-rule-${index}-label`}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Mã rule
                          </span>
                          <input
                            value={rule.id}
                            onChange={(event) =>
                              setDraftRules((rules) =>
                                updateDraftRule(rules, index, { id: event.target.value }),
                              )
                            }
                            disabled={policyFormDisabled}
                            data-testid={`policy-rule-${index}-id`}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                          />
                        </label>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={rule.enabled !== false}
                            onChange={(event) =>
                              setDraftRules((rules) =>
                                updateDraftRule(rules, index, { enabled: event.target.checked }),
                              )
                            }
                            disabled={policyFormDisabled}
                            data-testid={`policy-rule-${index}-enabled`}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          Bật nhóm
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setDraftRules((rules) =>
                              rules.length > 1
                                ? rules.filter((_, ruleIndex) => ruleIndex !== index)
                                : rules,
                            )
                          }
                          disabled={policyFormDisabled || draftRules.length <= 1}
                          data-testid={`policy-rule-${index}-remove`}
                          className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                        >
                          <Trash2 size={14} />
                          Xóa
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Chế độ khớp
                        </span>
                        <select
                          value={rule.matchMode ?? 'substring'}
                          onChange={(event) =>
                            setDraftRules((rules) =>
                              updateDraftRule(rules, index, {
                                matchMode: event.target.value as GuardrailMatchMode,
                              }),
                            )
                          }
                          disabled={policyFormDisabled}
                          data-testid={`policy-rule-${index}-match-mode`}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                        >
                          {MATCH_MODE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-slate-500">
                          {
                            MATCH_MODE_OPTIONS.find(
                              (option) => option.value === (rule.matchMode ?? 'substring'),
                            )?.description
                          }
                        </p>
                      </label>

                      {rule.matchMode === 'fuzzy' && (
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Ngưỡng fuzzy
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            value={rule.fuzzyThreshold ?? 0.85}
                            onChange={(event) =>
                              setDraftRules((rules) =>
                                updateDraftRule(rules, index, {
                                  fuzzyThreshold: Number(event.target.value),
                                }),
                              )
                            }
                            disabled={policyFormDisabled}
                            data-testid={`policy-rule-${index}-fuzzy-threshold`}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                          />
                        </label>
                      )}

                      {rule.matchMode === 'semantic' && (
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Ngưỡng semantic
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            value={rule.semanticThreshold ?? 0.78}
                            onChange={(event) =>
                              setDraftRules((rules) =>
                                updateDraftRule(rules, index, {
                                  semanticThreshold: Number(event.target.value),
                                }),
                              )
                            }
                            disabled={policyFormDisabled}
                            data-testid={`policy-rule-${index}-semantic-threshold`}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                          />
                        </label>
                      )}
                    </div>

                    <div className="mt-4">
                      <label className="block space-y-1">
                        <span className="text-sm font-semibold text-slate-800">
                          Cụm từ bị chặn
                        </span>
                        <textarea
                          value={linesFromList(rule.phrases)}
                          onChange={(event) =>
                            setDraftRules((rules) =>
                              updateDraftRule(rules, index, {
                                phrases: parseLineList(event.target.value),
                              }),
                            )
                          }
                          disabled={policyFormDisabled}
                          data-testid={index === 0 ? 'policy-keywords' : `policy-rule-${index}-phrases`}
                          rows={6}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                          placeholder="Mỗi dòng một cụm từ cần chặn."
                        />
                        <p className="text-xs text-slate-500">
                          Biến thể và từ đồng nghĩa được hệ thống tự bổ sung khi lưu — không cần nhập tay.
                        </p>
                      </label>
                    </div>
                  </div>
                ))}

                <p className="text-xs text-slate-500">
                  Đang có {normalizedDraftRules.length} nhóm rule và{' '}
                  {countActivePhrases(normalizedDraftRules)} cụm từ sau khi chuẩn hóa.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="safeRefusalMessage"
                  className="text-sm font-semibold text-slate-800"
                >
                  Câu trả lời khi bị chặn
                </label>
                <textarea
                  id="safeRefusalMessage"
                  value={safeRefusalMessage}
                  onChange={(event) => setSafeRefusalMessage(event.target.value)}
                  data-testid="policy-safe-refusal"
                  disabled={policyFormDisabled}
                  rows={5}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  placeholder="Thông điệp hiển thị cho người dùng khi câu hỏi bị chặn."
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="policyReason"
                  className="text-sm font-semibold text-slate-800"
                >
                  Lý do cập nhật
                </label>
                <input
                  id="policyReason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  data-testid="policy-reason"
                  disabled={policyFormDisabled}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  placeholder="Ví dụ: bổ sung chính sách cho giai đoạn khảo thí."
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void savePolicy()}
                  disabled={
                    policyFormDisabled ||
                    !safeRefusalMessage.trim() ||
                    !isDirty
                  }
                  aria-label="Lưu cấu hình AI"
                  data-testid="policy-save"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Save size={16} />
                  {saving ? 'Đang lưu...' : 'Lưu chính sách AI'}
                </button>
                <button
                  type="button"
                  onClick={resetPolicy}
                  data-testid="policy-reset"
                  disabled={policyFormDisabled || !isDirty}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  <RotateCcw size={16} />
                  Đặt lại biểu mẫu
                </button>
              </div>
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <Sparkles className="text-blue-600" size={18} />
              Preview kiểm tra rule
            </h2>

            <div className="mt-5 space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Trạng thái hiện tại
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-800">
                  {policyLoading
                    ? 'Đang tải cấu hình...'
                    : enabled
                      ? 'Đang chặn câu hỏi nhạy cảm.'
                      : 'Đang cho phép tất cả câu hỏi.'}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {policyLoading
                    ? 'Vui lòng chờ hệ thống nạp lại cấu hình.'
                    : `Phiên bản hiện tại v${policyVersion}, cập nhật gần nhất ${lastUpdated}.`}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Nhóm rule đang so khớp
                </p>
                <div className="mt-3 space-y-2">
                  {normalizedDraftRules.length > 0 ? (
                    normalizedDraftRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-3"
                      >
                        <p className="text-sm font-semibold text-slate-800">
                          {rule.label}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {rule.id} · {matchModeLabel(rule.matchMode)} ·{' '}
                          {rule.enabled === false ? 'đang tắt' : 'đang bật'}
                        </p>
                      </div>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">Chưa có nhóm rule nào.</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="policyPreviewText"
                  className="text-sm font-semibold text-slate-800"
                >
                  Nội dung thử nghiệm
                </label>
                <textarea
                  id="policyPreviewText"
                  value={policyPreviewText}
                  onChange={(event) => setPolicyPreviewText(event.target.value)}
                  rows={6}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  placeholder="Nhập một câu hỏi hoặc đoạn văn để kiểm tra rule."
                />
              </div>

              <div
                data-testid="policy-preview-result"
                className={`rounded-2xl border px-4 py-4 ${
                  policyLoading
                    ? 'border-slate-200 bg-slate-50 text-slate-600'
                    : !enabled
                      ? 'border-slate-200 bg-slate-50 text-slate-700'
                      : policyPreviewBlocked
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-wide">
                  Kết quả preview
                </p>
                <p className="mt-3 text-sm font-semibold">
                  {policyLoading
                    ? 'Đang tải chính sách...'
                    : !enabled
                      ? 'Chính sách hiện đang tắt nên nội dung này sẽ không bị chặn.'
                      : !policyPreviewText.trim()
                        ? 'Nhập nội dung thử nghiệm để kiểm tra rule.'
                        : policyPreviewBlocked
                          ? 'Nội dung thử nghiệm sẽ bị chặn.'
                          : 'Nội dung thử nghiệm hiện không khớp rule nào trong preview.'}
                </p>
                {policyPreviewBlocked && previewMatch && (
                  <>
                    <div className="mt-3 space-y-2 text-sm">
                      <p>
                        <span className="font-semibold">Nhóm khớp:</span>{' '}
                        {previewMatch.ruleLabel} ({previewMatch.ruleId})
                      </p>
                      <p>
                        <span className="font-semibold">Cụm khớp:</span>{' '}
                        {previewMatch.matchedPhrase}
                      </p>
                      <p>
                        <span className="font-semibold">Lớp khớp:</span>{' '}
                        {previewLayerLabel(previewMatch.matchLayer)}
                      </p>
                      <p>
                        <span className="font-semibold">Điểm:</span>{' '}
                        {(previewMatch.score * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="mt-3 rounded-xl border border-red-200 bg-white/70 px-3 py-3 text-sm text-slate-700">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Câu trả lời sẽ hiển thị
                      </p>
                      <p className="mt-2 leading-relaxed">
                        {safeRefusalMessage.trim() || 'Chưa có nội dung phản hồi.'}
                      </p>
                    </div>
                  </>
                )}
                {!policyPreviewBlocked && enabled && policyPreviewText.trim() && (
                  <p className="mt-3 text-xs text-slate-500">
                    Rule semantic chỉ được đánh giá trên server khi bật
                    GUARDRAIL_SEMANTIC_ENABLED.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Preview metadata tài liệu (sau retrieval)
                </p>
                <label className="mt-3 block text-sm font-semibold text-slate-800">
                  Preset metadata
                </label>
                <select
                  value={docSecurityPreset}
                  onChange={(event) => {
                    const value = event.target.value as
                      | keyof typeof DOCUMENT_SECURITY_PRESETS
                      | 'custom'
                    setDocSecurityPreset(value)
                    if (value !== 'custom') {
                      setDocSecurityCustomJson(
                        JSON.stringify(DOCUMENT_SECURITY_PRESETS[value], null, 2),
                      )
                    }
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                  data-testid="doc-security-preset"
                >
                  <option value="practice-public">Đề thi thử công khai</option>
                  <option value="official-upcoming">Đề chính thức sắp tới (embargo)</option>
                  <option value="answer-key">Đáp án / lộ đề (examType)</option>
                  <option value="answer-key-tag-only">Đáp án (tag answer_key)</option>
                  <option value="legacy-exam-category">Legacy Lịch thi thiếu metadata</option>
                  <option value="chunk-fallback-practice">Chunk thiếu metadata + fallback doc</option>
                  <option value="legacy-internal">Tài liệu nội bộ legacy</option>
                  <option value="custom">JSON tùy chỉnh</option>
                </select>
                {(docSecurityPreset === 'custom' || docSecurityCustomJson) && (
                  <textarea
                    value={docSecurityCustomJson}
                    onChange={(event) => {
                      setDocSecurityPreset('custom')
                      setDocSecurityCustomJson(event.target.value)
                    }}
                    rows={8}
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800"
                    data-testid="doc-security-custom-json"
                    placeholder='{"category":"Lịch thi"} hoặc {"documentMetadata":{"category":"Lịch thi"},"chunkMetadata":{...}}'
                  />
                )}
                {docSecurityCustomError && (
                  <p className="mt-2 text-xs text-red-600">{docSecurityCustomError}</p>
                )}
                <div
                  data-testid="doc-security-preview-result"
                  className={`mt-3 rounded-xl border px-3 py-3 text-sm ${
                    docSecurityDecision.allowed
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  <p className="font-semibold">
                    {docSecurityDecision.allowed
                      ? 'Chunk được phép đưa vào context LLM'
                      : 'Chunk bị chặn sau retrieval'}
                  </p>
                  {!docSecurityDecision.allowed && (
                    <div className="mt-2 space-y-1 text-xs">
                      <p>
                        <span className="font-semibold">Rule:</span>{' '}
                        {docSecurityDecision.matchedRuleId}
                      </p>
                      <p>
                        <span className="font-semibold">domain:</span>{' '}
                        {docSecurityDecision.details.domain}
                      </p>
                      <p>
                        <span className="font-semibold">securityLevel:</span>{' '}
                        {docSecurityDecision.details.securityLevel}
                      </p>
                      <p>
                        <span className="font-semibold">publicationStatus:</span>{' '}
                        {docSecurityDecision.details.publicationStatus}
                      </p>
                      <p>
                        <span className="font-semibold">denyReason:</span>{' '}
                        {docSecurityDecision.reason}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Câu trả lời khi bị chặn
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {safeRefusalMessage.trim() || 'Chưa có nội dung phản hồi.'}
                </p>
              </div>
            </div>
          </aside>
        </section>
      )}

      {activeTab === 'technical' && (
        <>
          <section className="mt-6 grid gap-6 xl:grid-cols-3">
            <AdminTechnicalDetails
              testId="admin-system-technical"
              description="Payload raw của health gateway và tên kỹ thuật của các dịch vụ."
            >
              <div className="space-y-4">
                <dl className="grid gap-3 text-sm md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <dt className="text-slate-500">Mã trạng thái hệ thống</dt>
                    <dd className="mt-1 font-semibold text-slate-800">
                      {health?.status ?? 'unknown'}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <dt className="text-slate-500">Thời điểm kiểm tra gần nhất</dt>
                    <dd className="mt-1 font-semibold text-slate-800">
                      {formatTimestamp(health?.timestamp)}
                    </dd>
                  </div>
                </dl>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Tên dịch vụ kỹ thuật
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {SERVICE_META.map((service) => (
                      <li key={service.key}>
                        {service.label}:{' '}
                        <span className="font-mono text-xs">{service.technicalName}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-950 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Raw health payload
                  </p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-100">
                    {health ? JSON.stringify(health, null, 2) : 'Chưa có dữ liệu'}
                  </pre>
                </div>
              </div>
            </AdminTechnicalDetails>

            <AdminTechnicalDetails
              testId="admin-ops-overview-technical"
              description="Quota policy, nguồn dữ liệu và snapshot raw dùng cho vận hành tài khoản."
            >
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-bold text-slate-800">Quota và phiên đăng nhập</h3>
                  <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">Rate limit auth</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {opsOverview?.quota_policy.rate_limit_auth_per_minute ?? 0}/phút
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Rate limit anonymous</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {opsOverview?.quota_policy.rate_limit_anon_per_minute ?? 0}/phút
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Load shedding</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {opsOverview?.quota_policy.load_shedding_max_concurrent ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Login max attempts</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {opsOverview?.quota_policy.login_max_attempts ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Access / refresh token</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {opsOverview
                          ? `${opsOverview.quota_policy.access_token_ttl} / ${opsOverview.quota_policy.refresh_token_ttl_days} ngày`
                          : '...'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Khóa tạm sau đăng nhập sai</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {opsOverview?.quota_policy.login_lock_duration_seconds ?? 0} giây
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-bold text-slate-800">Nguồn dữ liệu</h3>
                  <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">MongoDB</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {opsOverview?.sources.mongo_available ? 'Sẵn sàng' : 'Chưa sẵn sàng'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Redis</dt>
                      <dd className="mt-1 font-semibold text-slate-800">
                        {opsOverview?.sources.redis_available ? 'Sẵn sàng' : 'Chưa sẵn sàng'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-950 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Raw overview payload
                  </p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-100">
                    {opsOverview
                      ? JSON.stringify(opsOverview, null, 2)
                      : 'Chưa có dữ liệu'}
                  </pre>
                </div>
              </div>
            </AdminTechnicalDetails>

            <AdminTechnicalDetails
              testId="admin-policy-technical"
              description="Metadata cấu hình và JSON gốc của chính sách AI."
            >
              <div className="space-y-4">
                <dl className="grid gap-3 text-sm md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <dt className="text-slate-500">Khóa cấu hình</dt>
                    <dd className="mt-1 font-semibold text-slate-800">
                      {policy?.config_key ?? 'rag_policy'}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <dt className="text-slate-500">Phiên bản</dt>
                    <dd className="mt-1 font-semibold text-slate-800">
                      {policyLoading ? '...' : `v${policyVersion}`}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <dt className="text-slate-500">Cập nhật gần nhất</dt>
                    <dd className="mt-1 font-semibold text-slate-800">
                      {lastUpdated}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <dt className="text-slate-500">Vai trò quản trị hiện tại</dt>
                    <dd className="mt-1 font-semibold text-slate-800">
                      {normalizedRoles.join(', ') || 'Không có'}
                    </dd>
                  </div>
                </dl>
                <div className="rounded-xl border border-slate-200 bg-slate-950 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Raw policy payload
                  </p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-100">
                    {policy ? JSON.stringify(policy, null, 2) : 'Chưa có dữ liệu'}
                  </pre>
                </div>
              </div>
            </AdminTechnicalDetails>
          </section>

          <AdminAuditSection />
        </>
      )}
    </div>
  )
}
