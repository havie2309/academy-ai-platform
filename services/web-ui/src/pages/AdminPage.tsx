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
import { formatRoleLabel, normalizeRoles } from '../lib/authz'

type UpstreamKey = keyof GatewayHealth['upstream']

const SERVICE_META: Array<{
  key: UpstreamKey
  label: string
  description: string
}> = [
  {
    key: 'userManagement',
    label: 'Quản lý người dùng',
    description: 'Đăng nhập, token làm mới và hồ sơ người dùng.',
  },
  {
    key: 'chat',
    label: 'Dịch vụ chat',
    description: 'Quản lý phiên, luồng phát và lịch sử hỏi đáp.',
  },
  {
    key: 'rbac',
    label: 'Phân quyền (RBAC)',
    description: 'Ma trận quyền, phạm vi truy cập và lọc theo dòng dữ liệu.',
  },
  {
    key: 'adminConfig',
    label: 'Cấu hình quản trị',
    description: 'Chính sách có phiên bản cho từ chối an toàn và lời nhắc hệ thống.',
  },
  {
    key: 'audit',
    label: 'Nhật ký kiểm tra',
    description: 'Đọc nhật ký kiểm tra và theo dõi thay đổi nhạy cảm.',
  },
  {
    key: 'rag',
    label: 'RAG Engine',
    description: 'Truy xuất, trích dẫn, từ chối và điều phối SQL.',
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

function statusLabel(status: 'up' | 'down'): string {
  return status === 'up' ? 'Hoạt động' : 'Ngừng'
}

function gatewayStatusLabel(status: string | undefined): string {
  return status === 'ok' ? 'Ổn định' : 'Suy giảm'
}

function statusTone(status: 'up' | 'down') {
  return status === 'up'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-red-200 bg-red-50 text-red-700'
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
        throw new Error('Không tải được trạng thái sức khỏe từ API gateway.')
      }
      setHealth(nextHealth)
    } catch (error) {
      setHealthError(
        error instanceof Error ? error.message : 'Không tải được trạng thái sức khỏe.',
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
        error instanceof Error ? error.message : 'Không tải được chính sách AI.',
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

  const isDirty =
    !!policy &&
    (enabled !== policy.value.enabled ||
      safeRefusalMessage.trim() !== policy.value.safeRefusalMessage ||
      JSON.stringify(parsedKeywords) !==
        JSON.stringify(policy.value.blacklistKeywords) ||
      !!reason.trim())

  const savePolicy = async () => {
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
      setSaveMessage('Đã lưu chính sách AI thành công.')
    } catch (error) {
      setPolicyError(
        error instanceof Error ? error.message : 'Không lưu được chính sách AI.',
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

  return (
    <div
      className="flex flex-col h-full bg-slate-50/60 p-6 md:p-8 overflow-y-auto"
      data-testid="admin-page"
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-800">
            <LayoutDashboard className="text-blue-600" />
            Vận hành hệ thống và chính sách AI
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Quan sát sức khỏe các dịch vụ và cập nhật chính sách từ chối/danh sách chặn
            cho trợ lý AI ngay trên giao diện quản trị.
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

      {(healthError || policyError || saveMessage) && (
        <div className="mt-5 space-y-3">
          {healthError && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 shrink-0" size={16} />
              <span>{healthError}</span>
            </div>
          )}
          {policyError && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 shrink-0" size={16} />
              <span>{policyError}</span>
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
                Trạng thái gateway
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-800">
                {healthLoading
                  ? '...'
                  : gatewayStatusLabel(health?.status)}
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
            Gateway và các route proxy hiện{' '}
            {health?.status === 'ok' ? 'ổn định.' : 'có dịch vụ cần lưu ý.'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Dịch vụ upstream hoạt động
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {healthLoading ? '...' : `${healthyServices}/${SERVICE_META.length}`}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Đang hoạt động tốt: {healthyServices} dịch vụ. Cần kiểm tra: {degradedServices}.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Phiên bản chính sách AI
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {policyLoading ? '...' : `v${policyVersion}`}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            {enabled ? 'Từ chối an toàn đang bật.' : 'Từ chối an toàn đang tắt.'}
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
            Từ khóa hiện có: {parsedKeywords.length}
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <Server className="text-blue-600" size={18} />
              Sức khỏe hệ thống
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Trạng thái gateway và 6 dịch vụ upstream đang được proxy trong môi trường chạy.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadHealth()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white"
          >
            <RefreshCw size={15} />
            Làm mới sức khỏe
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
                    {healthLoading ? '...' : statusLabel(status)}
                  </span>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                <Bot className="text-blue-600" size={18} />
                Trình soạn cấu hình AI
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Bật/tắt từ chối an toàn, sửa danh sách chặn và thông điệp trả lời an toàn.
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
                  Kích hoạt từ chối an toàn
                </span>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Nếu tắt, câu hỏi nhạy cảm sẽ không bị chặn bởi chính sách từ cấu hình quản trị.
                </p>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                data-testid="policy-enabled-toggle"
                className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                aria-label="Kích hoạt từ chối an toàn"
                disabled={policyLoading || saving}
              />
            </label>

            <div className="space-y-2">
              <label
                htmlFor="blacklistKeywords"
                className="text-sm font-semibold text-slate-800"
              >
                Từ khóa danh sách chặn
              </label>
              <textarea
                id="blacklistKeywords"
                value={keywordText}
                onChange={(event) => setKeywordText(event.target.value)}
                data-testid="policy-keywords"
                disabled={policyLoading || saving}
                rows={8}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                placeholder="Mỗi dòng một từ khóa. Có thể dùng dấu phẩy nếu muốn."
              />
              <p className="text-xs text-slate-500">
                Hiện có {parsedKeywords.length} từ khóa sau khi loại bỏ trùng.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="safeRefusalMessage"
                className="text-sm font-semibold text-slate-800"
              >
                Thông điệp từ chối an toàn
              </label>
              <textarea
                id="safeRefusalMessage"
                value={safeRefusalMessage}
                onChange={(event) => setSafeRefusalMessage(event.target.value)}
                data-testid="policy-safe-refusal"
                disabled={policyLoading || saving}
                rows={5}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                placeholder="Thông điệp hiển thị cho người dùng khi câu hỏi bị từ chối."
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="policyReason" className="text-sm font-semibold text-slate-800">
                Lý do cập nhật
              </label>
              <input
                id="policyReason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                data-testid="policy-reason"
                disabled={policyLoading || saving}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                placeholder="Ví dụ: bổ sung từ khóa nhạy cảm cho đợt khảo thí"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void savePolicy()}
                disabled={
                  policyLoading ||
                  saving ||
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
                disabled={policyLoading || saving || !isDirty}
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
            Xem trước và siêu dữ liệu
          </h2>

          <div className="mt-5 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Siêu dữ liệu hiện tại
              </p>
              <dl className="mt-3 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Khóa cấu hình</dt>
                  <dd className="font-semibold text-slate-800">
                    {policy?.config_key ?? 'rag_policy'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Phiên bản</dt>
                  <dd className="font-semibold text-slate-800">
                    {policyLoading ? '...' : `v${policyVersion}`}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Cập nhật lúc</dt>
                  <dd className="font-semibold text-slate-800">{lastUpdated}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Đang bật</dt>
                  <dd
                    className={`font-semibold ${
                      enabled ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {enabled ? 'Có' : 'Không'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Xem trước từ khóa
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
                Ngữ cảnh vai trò quản trị
              </p>
              <p className="mt-3 text-sm text-slate-600">
                Giao diện đang nhận vai trò theo mã: {normalizedRoles.join(', ') || 'Không có'}.
                Bộ bảo vệ route và menu quản trị đã được chuẩn hóa để tương thích cả vai trò thử nghiệm
                và vai trò từ backend thực tế.
              </p>
            </div>
          </div>
        </aside>
      </section>

      <AdminOpsSection />
      <AdminAuditSection />
    </div>
  )
}
