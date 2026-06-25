import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import {
  adminApi,
  fetchGatewayHealth,
  type GatewayHealth,
  type RagPolicyConfig,
  type StoredAdminConfig,
} from '../api/admin'
import { authApi } from '../api/auth'
import AdminAuditSection from '../components/admin/AdminAuditSection'
import AdminOpsSection from '../components/admin/AdminOpsSection'
import AdminTechnicalDetails from '../components/admin/AdminTechnicalDetails'
import { formatRoleLabel, normalizeRoles } from '../lib/authz'

type UpstreamKey = keyof GatewayHealth['upstream']

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

function parseKeywords(text: string): string[] {
  const seen = new Set<string>()
  const values: string[] = []
  for (const item of text.split(/[\r\n,]+/)) {
    const keyword = item.trim()
    if (!keyword) continue
    const key = keyword.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    values.push(keyword)
  }
  return values
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

function hydrateForm(
  config: StoredAdminConfig<RagPolicyConfig>,
  setEnabled: (value: boolean) => void,
  setKeywordText: (value: string) => void,
  setSafeRefusal: (value: string) => void,
  setReason: (value: string) => void,
) {
  setEnabled(config.value.enabled)
  setKeywordText(config.value.blacklistKeywords.join('\n'))
  setSafeRefusal(config.value.safeRefusalMessage)
  setReason('')
}

export default function AdminPage() {
  const user = authApi.getUser()
  const normalizedRoles = normalizeRoles(user?.roles)

  const [health, setHealth] = useState<GatewayHealth | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [healthError, setHealthError] = useState<string | null>(null)

  const [policy, setPolicy] =
    useState<StoredAdminConfig<RagPolicyConfig> | null>(null)
  const [policyLoading, setPolicyLoading] = useState(true)
  const [policyError, setPolicyError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [enabled, setEnabled] = useState(true)
  const [keywordText, setKeywordText] = useState('')
  const [safeRefusalMessage, setSafeRefusalMessage] = useState('')
  const [reason, setReason] = useState('')

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
        setKeywordText,
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

  useEffect(() => {
    void loadHealth()
    void loadPolicy()
  }, [])

  const parsedKeywords = parseKeywords(keywordText)
  const healthyServices = SERVICE_META.filter(
    (service) => health?.upstream[service.key] === 'up',
  ).length
  const degradedServices = SERVICE_META.length - healthyServices
  const policyVersion = policy?.version ?? 0
  const lastUpdated = formatTimestamp(policy?.updated_at)
  const policyFormDisabled = policyLoading || saving || !policy

  const isDirty =
    !!policy &&
    (enabled !== policy.value.enabled ||
      safeRefusalMessage.trim() !== policy.value.safeRefusalMessage ||
      JSON.stringify(parsedKeywords) !==
        JSON.stringify(policy.value.blacklistKeywords) ||
      !!reason.trim())

  const savePolicy = async () => {
    if (!policy) return
    setSaving(true)
    setSaveMessage(null)
    setPolicyError(null)
    try {
      const updated = await adminApi.updateRagPolicy({
        enabled,
        blacklistKeywords: parsedKeywords,
        safeRefusalMessage: safeRefusalMessage.trim(),
        reason: reason.trim(),
      })
      setPolicy(updated)
      hydrateForm(
        updated,
        setEnabled,
        setKeywordText,
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
      setKeywordText,
      setSafeRefusalMessage,
      setReason,
    )
    setSaveMessage(null)
    setPolicyError(null)
  }

  const healthNotice = healthError
    ? humanizeError(healthError, 'Trạng thái hệ thống')
    : null
  const policyNotice = policyError
    ? humanizeError(policyError, 'Chính sách an toàn AI')
    : null

  return (
    <div
      className="flex h-full flex-col overflow-y-auto bg-slate-50/60 p-6 md:p-8"
      data-testid="admin-page"
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-800">
            <LayoutDashboard className="text-blue-600" />
            Vận hành hệ thống và chính sách AI
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Theo dõi tình trạng hệ thống, quản lý chính sách an toàn AI và hỗ
            trợ các tác vụ quản trị hằng ngày theo cách dễ đọc hơn cho người
            vận hành.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(user?.roles ?? []).map((role) => (
              <span
                key={role}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
              >
                {formatRoleLabel(role)}
              </span>
            ))}
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
              {user?.username ?? 'ẩn danh'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              void loadHealth()
              void loadPolicy()
            }}
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

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
            Dịch vụ hệ thống
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {healthLoading ? '...' : `${healthyServices}/${SERVICE_META.length}`}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Đang hoạt động tốt: {healthyServices}. Cần kiểm tra thêm:{' '}
            {degradedServices}.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Chính sách an toàn AI
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {policyLoading ? '...' : enabled ? 'Đang bật' : 'Đang tắt'}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            {policyLoading
              ? 'Đang tải trạng thái chính sách.'
              : `Từ khóa đang áp dụng: ${policy?.value.blacklistKeywords.length ?? 0}.`}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Cập nhật chính sách gần nhất
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Clock3 size={16} className="text-slate-400" />
            {policyLoading ? 'Đang tải...' : lastUpdated}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Phiên bản hiện tại: {policyLoading ? '...' : `v${policyVersion}`}.
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <Server className="text-blue-600" size={18} />
              Dịch vụ hệ thống
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Danh sách các dịch vụ chính mà trang quản trị đang sử dụng hằng
              ngày.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadHealth()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white"
          >
            <RefreshCw size={15} />
            Làm mới trạng thái hệ thống
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

        <div className="mt-5">
          <AdminTechnicalDetails
            testId="admin-system-technical"
            description="Thông tin kỹ thuật dành cho hỗ trợ kiểm tra khi có dịch vụ bị gián đoạn."
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Mã trạng thái hệ thống
                  </p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {health?.status ?? 'unknown'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Thời điểm kiểm tra gần nhất
                  </p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {formatTimestamp(health?.timestamp)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Tên dịch vụ kỹ thuật
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {SERVICE_META.map((service) => (
                      <li key={service.key}>
                        {service.label}: <span className="font-mono text-xs">{service.technicalName}</span>
                      </li>
                    ))}
                  </ul>
                </div>
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
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                <Bot className="text-blue-600" size={18} />
                Chính sách an toàn AI
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Bật hoặc tắt chặn câu hỏi nhạy cảm, cập nhật từ khóa bị chặn và
                điều chỉnh câu trả lời hiển thị cho người dùng.
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
                  Khi bật, hệ thống sẽ chặn những yêu cầu thuộc danh sách không
                  an toàn trước khi gửi sang trợ lý AI.
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

            <div className="space-y-2">
              <label
                htmlFor="blacklistKeywords"
                className="text-sm font-semibold text-slate-800"
              >
                Từ khóa bị chặn
              </label>
              <textarea
                id="blacklistKeywords"
                value={keywordText}
                onChange={(event) => setKeywordText(event.target.value)}
                data-testid="policy-keywords"
                disabled={policyFormDisabled}
                rows={8}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                placeholder="Mỗi dòng một từ khóa hoặc cụm từ cần chặn."
              />
              <p className="text-xs text-slate-500">
                Đang có {parsedKeywords.length} từ khóa sau khi loại bỏ trùng lặp.
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
            Tóm tắt cho quản trị viên
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
                  : 'Hãy kiểm tra kỹ thông điệp từ chối để đảm bảo phù hợp với người dùng cuối.'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Từ khóa đang chặn
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {parsedKeywords.length > 0 ? (
                  parsedKeywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                    >
                      {keyword}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">
                    Chưa có từ khóa nào.
                  </span>
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

            <AdminTechnicalDetails
              testId="admin-policy-technical"
              description="Metadata cấu hình, vai trò quản trị hiện tại và dữ liệu JSON gốc dành cho kiểm tra sâu."
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
                    {policy
                      ? JSON.stringify(policy, null, 2)
                      : 'Chưa có dữ liệu'}
                  </pre>
                </div>
              </div>
            </AdminTechnicalDetails>
          </div>
        </aside>
      </section>

      <AdminOpsSection />
      <AdminAuditSection />
    </div>
  )
}
