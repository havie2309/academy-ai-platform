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
  TriangleAlert,
} from 'lucide-react'
import {
  adminApi,
  fetchGatewayHealth,
  type GatewayHealth,
  type RagPolicyConfig,
  type StoredAdminConfig,
} from '../api/admin'
import { authApi } from '../api/auth'
import { formatRoleLabel, normalizeRoles } from '../lib/authz'

type UpstreamKey = keyof GatewayHealth['upstream']

const SERVICE_META: Array<{
  key: UpstreamKey
  label: string
  description: string
}> = [
  {
    key: 'userManagement',
    label: 'User Management',
    description: 'Dang nhap, refresh token va ho so nguoi dung.',
  },
  {
    key: 'chat',
    label: 'Chat Service',
    description: 'Quan ly session, stream va lich su hoi dap.',
  },
  {
    key: 'rbac',
    label: 'RBAC',
    description: 'Permission matrix, access scope va row filter.',
  },
  {
    key: 'adminConfig',
    label: 'Admin Config',
    description: 'Versioned policy cho safe refusal va prompt.',
  },
  {
    key: 'audit',
    label: 'Audit',
    description: 'Doc audit log va theo doi thay doi nhay cam.',
  },
  {
    key: 'rag',
    label: 'RAG Engine',
    description: 'Retrieve, citation, refusal va SQL orchestration.',
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
  if (!value) return 'Chua cap nhat'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('vi-VN')
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
        throw new Error('Khong tai duoc health tu API gateway.')
      }
      setHealth(nextHealth)
    } catch (error) {
      setHealthError(
        error instanceof Error ? error.message : 'Khong tai duoc health.',
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
        error instanceof Error ? error.message : 'Khong tai duoc AI policy.',
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
      setSaveMessage('Da luu AI policy thanh cong.')
    } catch (error) {
      setPolicyError(
        error instanceof Error ? error.message : 'Khong luu duoc AI policy.',
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
            Van hanh he thong va AI policy
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Quan sat suc khoe cac service va cap nhat chinh sach refusal/blacklist
            cho tro ly AI ngay tren giao dien quan tri.
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
              {user?.username ?? 'anonymous'}
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
            Tai lai du lieu
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
                Gateway status
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-800">
                {healthLoading
                  ? '...'
                  : health?.status === 'ok'
                    ? 'OK'
                    : 'Degraded'}
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
            Gateway va cac route proxy hien dang{' '}
            {health?.status === 'ok' ? 'on dinh.' : 'co service can luu y.'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Upstream healthy
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {healthLoading ? '...' : `${healthyServices}/${SERVICE_META.length}`}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Dang hoat dong tot: {healthyServices} service. Can kiem tra: {degradedServices}.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            AI policy version
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            {policyLoading ? '...' : `v${policyVersion}`}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            {enabled ? 'Safe refusal dang bat.' : 'Safe refusal dang tat.'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Last policy update
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Clock3 size={16} className="text-slate-400" />
            {policyLoading ? 'Dang tai...' : lastUpdated}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Keyword hien co: {parsedKeywords.length}
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <Server className="text-blue-600" size={18} />
              Admin health view
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Trang thai gateway va 6 upstream dang duoc proxy trong runtime.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadHealth()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white"
          >
            <RefreshCw size={15} />
            Refresh health
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
                    {healthLoading ? '...' : status}
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
                Admin AI config editor
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Bat/tat refusal, sua blacklist va thong diep tra loi an toan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadPolicy()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white"
            >
              <RefreshCw size={15} />
              Tai lai policy
            </button>
          </div>

          <div className="mt-5 space-y-5">
            <label className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
              <div>
                <span className="text-sm font-semibold text-slate-800">
                  Kich hoat safe refusal
                </span>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Neu tat, query nhay cam se khong bi chan boi policy tu admin-config.
                </p>
              </div>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                data-testid="policy-enabled-toggle"
                className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                aria-label="Kich hoat safe refusal"
                disabled={policyLoading || saving}
              />
            </label>

            <div className="space-y-2">
              <label
                htmlFor="blacklistKeywords"
                className="text-sm font-semibold text-slate-800"
              >
                Blacklist keywords
              </label>
              <textarea
                id="blacklistKeywords"
                value={keywordText}
                onChange={(event) => setKeywordText(event.target.value)}
                data-testid="policy-keywords"
                disabled={policyLoading || saving}
                rows={8}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                placeholder="Moi dong mot keyword. Co the dung dau phay neu muon."
              />
              <p className="text-xs text-slate-500">
                Hien dang co {parsedKeywords.length} keyword sau khi loai bo trung.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="safeRefusalMessage"
                className="text-sm font-semibold text-slate-800"
              >
                Safe refusal message
              </label>
              <textarea
                id="safeRefusalMessage"
                value={safeRefusalMessage}
                onChange={(event) => setSafeRefusalMessage(event.target.value)}
                data-testid="policy-safe-refusal"
                disabled={policyLoading || saving}
                rows={5}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                placeholder="Thong diep hien cho nguoi dung khi query bi tu choi."
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="policyReason" className="text-sm font-semibold text-slate-800">
                Ly do cap nhat
              </label>
              <input
                id="policyReason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                data-testid="policy-reason"
                disabled={policyLoading || saving}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                placeholder="Vi du: bo sung tu khoa nhay cam cho dot khao thi"
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
                aria-label="Luu cau hinh AI"
                data-testid="policy-save"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Save size={16} />
                {saving ? 'Dang luu...' : 'Luu AI policy'}
              </button>
              <button
                type="button"
                onClick={resetPolicy}
                data-testid="policy-reset"
                disabled={policyLoading || saving || !isDirty}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                <RotateCcw size={16} />
                Reset form
              </button>
            </div>
          </div>
        </div>

        <aside className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <Sparkles className="text-blue-600" size={18} />
            Preview va metadata
          </h2>

          <div className="mt-5 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Current metadata
              </p>
              <dl className="mt-3 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Config key</dt>
                  <dd className="font-semibold text-slate-800">
                    {policy?.config_key ?? 'rag_policy'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Version</dt>
                  <dd className="font-semibold text-slate-800">
                    {policyLoading ? '...' : `v${policyVersion}`}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Updated at</dt>
                  <dd className="font-semibold text-slate-800">{lastUpdated}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Enabled</dt>
                  <dd
                    className={`font-semibold ${
                      enabled ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {enabled ? 'Yes' : 'No'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Keyword preview
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
                    Chua co keyword nao.
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Refusal preview
              </p>
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
                {safeRefusalMessage.trim() || 'Thong diep refusal se hien o day.'}
              </div>
              <div className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
                <TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber-500" />
                <span>
                  Query bi chan se duoc refusal truoc khi retrieve tai lieu, SQL hay
                  stream token, va event se duoc ghi vao audit/policy log.
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Admin role context
              </p>
              <p className="mt-3 text-sm text-slate-600">
                Frontend dang nhan role theo code: {normalizedRoles.join(', ') || 'N/A'}.
                Route guard va menu admin da duoc normalize de tuong thich ca mock
                role va role tu backend thuc.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  )
}
