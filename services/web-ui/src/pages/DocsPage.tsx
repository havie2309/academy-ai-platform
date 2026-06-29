import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, CheckCircle, AlertCircle } from 'lucide-react'
import {
  Search,
  FileText,
  Download,
  ExternalLink,
  Filter,
  BookOpen,
  Upload,
  FolderOpen,
  Trash2,
  X,
  Loader2,
  BarChart3,
  Shield,
  Users,
  Lock,
  EyeOff,
  LogIn,
} from 'lucide-react'
import {
  docsApi,
  type AiAccessPolicy,
  type DocItem,
  type IngestStatus,
  type PublicationStatus,
  type SecurityLevel,
  type AccessScopeType,
} from '../api/docs'
import { authApi } from '../api/auth'
import { API_BASE } from '../api/base'
import { isAdminLikeRole } from '../lib/authz'
import React from 'react'

const UPLOAD_CATEGORIES = ['Quy chế', 'Tài liệu môn học', 'Lịch thi', 'Khác']

const SECURITY_LEVELS: {
  value: SecurityLevel
  label: string
  badge: string
}[] = [
  { value: 'public', label: 'Công khai', badge: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { value: 'internal', label: 'Nội bộ', badge: 'bg-blue-50 text-blue-600 border-blue-200' },
  { value: 'restricted', label: 'Hạn chế', badge: 'bg-amber-50 text-amber-600 border-amber-200' },
  { value: 'confidential', label: 'Mật', badge: 'bg-red-50 text-red-600 border-red-200' },
]

const SCOPE_TYPES: { value: AccessScopeType; label: string }[] = [
  { value: 'all', label: 'Tất cả người dùng' },
  { value: 'role', label: 'Theo vai trò' },
  { value: 'department', label: 'Theo đơn vị' },
  { value: 'custom', label: 'Danh sách người dùng' },
]

const ROLE_OPTIONS: { code: string; label: string }[] = [
  { code: 'BGD', label: 'Ban Giám đốc' },
  { code: 'P2', label: 'Phòng Đào tạo' },
  { code: 'KHAO_THI', label: 'Ban Khảo thí' },
  { code: 'GIANG_VIEN', label: 'Giảng viên' },
  { code: 'HOC_VIEN', label: 'Học viên' },
]

const PUBLICATION_STATUSES: { value: PublicationStatus; label: string }[] = [
  { value: 'public', label: 'Công khai' },
  { value: 'internal', label: 'Nội bộ' },
  { value: 'confidential', label: 'Mật' },
  { value: 'embargoed', label: 'Phong toả' },
]

const AI_ACCESS_POLICIES: { value: AiAccessPolicy; label: string }[] = [
  { value: 'allow', label: 'Cho phép AI' },
  { value: 'restricted', label: 'Hạn chế AI' },
  { value: 'review_required', label: 'Cần duyệt' },
  { value: 'deny', label: 'Chặn AI' },
]

const EXAM_TYPE_OPTIONS = [
  { value: 'practice', label: 'Đề thi thử / luyện tập' },
  { value: 'study_guide', label: 'Tài liệu ôn tập' },
  { value: 'official', label: 'Đề chính thức' },
  { value: 'answer_key', label: 'Đáp án' },
]

const EXAM_STATUS_OPTIONS = [
  { value: 'upcoming', label: 'Sắp tới' },
  { value: 'active', label: 'Đang diễn ra' },
  { value: 'completed', label: 'Đã kết thúc' },
  { value: 'archived', label: 'Lưu trữ' },
]

const STAGE_ORDER = ['queued', 'extract', 'chunk', 'embed', 'index', 'done']
const STAGE_LABELS: Record<string, string> = {
  queued: 'Chờ xử lý',
  extract: 'Trích xuất',
  chunk: 'Chia đoạn',
  embed: 'Vector hóa',
  index: 'Chỉ mục',
  done: 'Hoàn tất',
}
interface VungDuLieuData {
  user: {
    userId: string
    roles: string[]
    department: string | null
    maxSecurityLevel: number
  }
  summary: {
    total: number
    accessible: number
    inaccessible: number
    rate: number
  }
  bySecurityLevel: Array<{
    level: string
    name: string
    total: number
    accessible: number
    inaccessible: number
  }>
  byCategory: Array<{
    category: string
    total: number
    accessible: number
    inaccessible: number
  }>
  byScope: Array<{
    scope: string
    total: number
    accessible: number
    inaccessible: number
  }>
  sampleDocs: {
    total: number
    accessible: number
    inaccessible: number
  }
  uploadDocs: {
    total: number
    accessible: number
    inaccessible: number
  }
  inaccessibleReasons: {
    bySecurityLevel: Record<string, number>
    byRole: Record<string, number>
    byDepartment: Record<string, number>
  }
  inaccessibleList: Array<{
    id: string
    title: string
    securityLevel: string
    reason: string
  }>
}

function VungDuLieuTab() {
  const [data, setData] = useState<VungDuLieuData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInaccessible, setShowInaccessible] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await docsApi.getVungDuLieu()
        setData(response)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu vùng')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Loader2 className="animate-spin mb-2" size={24} />
        <p className="text-sm font-medium">Đang tải vùng dữ liệu…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!data) return null

  const levelColors: Record<string, string> = {
    public: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    internal: 'bg-blue-100 text-blue-700 border-blue-200',
    restricted: 'bg-amber-100 text-amber-700 border-amber-200',
    confidential: 'bg-red-100 text-red-700 border-red-200',
  }

  const levelIcons: Record<string, React.ReactNode> = {
    public: '🟢',
    internal: '🔵',
    restricted: '🟠',
    confidential: '🔴',
  }

  return (
    <div className="space-y-6">
      {/* User Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2 mb-3">
          <Shield size={16} />
          Hồ sơ truy cập
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-slate-400 text-xs">Vai trò</span>
            <p className="font-semibold text-slate-700">
              {data.user.roles?.join(', ') || 'Không có'}
            </p>
          </div>
          <div>
            <span className="text-slate-400 text-xs">Đơn vị</span>
            <p className="font-semibold text-slate-700">
              {data.user.department || 'Không có'}
            </p>
          </div>
          <div>
            <span className="text-slate-400 text-xs">Mức mật tối đa</span>
            <p className="font-semibold text-slate-700">
              {data.user.maxSecurityLevel}
            </p>
          </div>
          <div>
            <span className="text-slate-400 text-xs">User ID</span>
            <p className="font-semibold text-slate-700 text-xs truncate">
              {data.user.userId}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats - 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/60 p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-blue-600">{data.summary.total}</div>
          <div className="text-xs text-slate-400 font-medium">Tổng tài liệu</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-emerald-600">{data.summary.accessible}</div>
          <div className="text-xs text-slate-400 font-medium">Có thể truy cập</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-red-600">{data.summary.inaccessible}</div>
          <div className="text-xs text-slate-400 font-medium">Không thể truy cập</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-purple-600">{data.summary.rate}%</div>
          <div className="text-xs text-slate-400 font-medium">Tỷ lệ truy cập</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium text-slate-600">Tỷ lệ truy cập</span>
          <span className="font-bold text-slate-800">{data.summary.rate}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3">
          <div
            className="bg-emerald-500 h-3 rounded-full transition-all duration-700"
            style={{ width: `${data.summary.rate}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span className="text-emerald-600">✅ {data.summary.accessible} có thể</span>
          <span className="text-red-600">❌ {data.summary.inaccessible} không thể</span>
        </div>
      </div>

      {/* By Security Level */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2 mb-4">
          <Lock size={16} />
          Theo mức mật
        </h3>
        <div className="space-y-3">
          {data.bySecurityLevel.map((item) => {
            const accessiblePct = item.total > 0 ? (item.accessible / item.total) * 100 : 0
            const isFullAccess = accessiblePct === 100 && item.total > 0
            const isNoAccess = accessiblePct === 0 && item.total > 0

            return (
              <div key={item.level}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700">
                    {levelIcons[item.level]} {item.name}
                  </span>
                  <span className="text-slate-500">
                    {item.accessible} / {item.total}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 mt-1 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      isFullAccess ? 'bg-emerald-500' :
                      isNoAccess ? 'bg-red-500' :
                      'bg-amber-500'
                    }`}
                    style={{ width: `${accessiblePct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* By Category */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2 mb-4">
          <FolderOpen size={16} />
          Theo danh mục
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {data.byCategory.map((item) => {
            const pct = item.total > 0 ? Math.round((item.accessible / item.total) * 100) : 0
            return (
              <div key={item.category} className="border border-slate-200 rounded-xl p-3">
                <div className="font-medium text-sm text-slate-700 truncate">{item.category}</div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-emerald-600">{item.accessible} có thể</span>
                  <span className="text-red-600">{item.inaccessible} không</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Source: Sample vs Upload */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2 mb-4">
          <Users size={16} />
          Nguồn tài liệu
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-slate-200 rounded-xl p-4 text-center">
            <div className="text-sm font-medium text-slate-600">📁 Tải lên</div>
            <div className="flex justify-center gap-4 mt-2 text-sm">
              <span className="text-emerald-600">{data.uploadDocs.accessible}</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-600">{data.uploadDocs.total}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all"
                style={{
                  width: data.uploadDocs.total > 0
                    ? `${(data.uploadDocs.accessible / data.uploadDocs.total) * 100}%`
                    : '0%'
                }}
              />
            </div>
          </div>
          <div className="border border-slate-200 rounded-xl p-4 text-center">
            <div className="text-sm font-medium text-slate-600">📚 Mẫu (sample)</div>
            <div className="flex justify-center gap-4 mt-2 text-sm">
              <span className="text-emerald-600">{data.sampleDocs.accessible}</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-600">{data.sampleDocs.total}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
              <div
                className="bg-purple-500 h-1.5 rounded-full transition-all"
                style={{
                  width: data.sampleDocs.total > 0
                    ? `${(data.sampleDocs.accessible / data.sampleDocs.total) * 100}%`
                    : '0%'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Why Can't I Access? */}
      {(data.inaccessibleReasons.bySecurityLevel &&
        Object.keys(data.inaccessibleReasons.bySecurityLevel).length > 0) && (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm border-l-4 border-l-red-500">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2 mb-3">
            <EyeOff size={16} />
            Tại sao không thể truy cập?
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.inaccessibleReasons.bySecurityLevel).map(([level, count]) => (
              <span
                key={level}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${levelColors[level] || 'bg-slate-100 text-slate-600 border-slate-200'}`}
              >
                {levelIcons[level]} Mức {level}: {count} tài liệu
              </span>
            ))}
            {Object.entries(data.inaccessibleReasons.byRole).map(([role, count]) => (
              <span
                key={role}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-50 text-orange-600 border border-orange-200"
              >
                👤 Vai trò {role}: {count} tài liệu
              </span>
            ))}
            {Object.entries(data.inaccessibleReasons.byDepartment).map(([dept, count]) => (
              <span
                key={dept}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-50 text-yellow-600 border border-yellow-200"
              >
                🏢 Đơn vị {dept}: {count} tài liệu
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Inaccessible Documents List (collapsible) */}
      {data.inaccessibleList && data.inaccessibleList.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
          <button
            type="button"
            onClick={() => setShowInaccessible(!showInaccessible)}
            className="w-full flex items-center justify-between text-sm font-bold text-slate-500 uppercase tracking-wide hover:text-slate-700 transition-colors"
          >
            <span className="flex items-center gap-2">
              <EyeOff size={16} />
              Tài liệu không thể truy cập ({data.inaccessibleList.length})
            </span>
            <span className="text-slate-400">
              {showInaccessible ? '▼' : '▶'}
            </span>
          </button>

          {showInaccessible && (
            <div className="mt-3 space-y-1 max-h-60 overflow-y-auto">
              {data.inaccessibleList.map((doc) => (
                <div
                  key={doc.id}
                  className="flex justify-between items-center py-2 px-3 border-b border-slate-100 text-sm hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <span className="text-slate-700 truncate flex-1 mr-2">
                    {doc.title}
                  </span>
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {doc.reason}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function securityMeta(level: SecurityLevel) {
  return SECURITY_LEVELS.find((s) => s.value === level) ?? SECURITY_LEVELS[1]
}

function ingestMeta(status?: IngestStatus) {
  switch (status) {
    case 'completed':
      return { label: 'Đã index', badge: 'bg-emerald-50 text-emerald-600 border-emerald-200' }
    case 'processing':
      return { label: 'Đang xử lý', badge: 'bg-amber-50 text-amber-600 border-amber-200' }
    case 'failed':
      return { label: 'Lỗi index', badge: 'bg-red-50 text-red-600 border-red-200' }
    default:
      return { label: 'Chờ xử lý', badge: 'bg-slate-50 text-slate-500 border-slate-200' }
  }
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('vi-VN')
  } catch {
    return iso
  }
}

function fileTypeLabel(name: string): string {
  const ext = name.split('.').pop()
  return ext ? ext.toUpperCase() : 'FILE'
}

const SUPPORTED_UPLOAD_MESSAGE =
  'Chỉ hỗ trợ tải lên file PDF (.pdf), Word (.docx), PowerPoint (.pptx), Excel (.xlsx) và text (.txt).'

const INGEST_POLL_BASE_MS = 5000
const INGEST_POLL_MAX_MS = 30000
const INGEST_POLL_WARN_AFTER = 3

function formatIngestPollWarning(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim()
    if (
      message.includes('Qua nhieu yeu cau') ||
      message.includes('Quá nhiều yêu cầu') ||
      message.includes('429')
    ) {
      return 'Trang tài liệu đang tự làm mới trạng thái ingest và đã chạm rate limit tạm thời. Vui lòng đợi khoảng 1 phút rồi thử lại.'
    }
    if (
      message.includes('đăng nhập') ||
      message.includes('Phi') ||
      message.includes('401')
    ) {
      return 'Phiên đăng nhập đã hết hạn nên chưa thể cập nhật trạng thái ingest. Vui lòng đăng nhập lại.'
    }
    if (message.includes('API gateway') || message.includes('3000')) {
      const target = API_BASE || 'proxy /api của web-ui'
      return `Chưa cập nhật được trạng thái ingest qua ${target}. Kiểm tra API gateway hoặc proxy rồi thử lại.`
    }
    if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
      const target = API_BASE || 'proxy /api của web-ui'
      return `Không kết nối được ${target} nên chưa thể cập nhật trạng thái ingest. Kiểm tra API gateway hoặc proxy rồi thử lại.`
    }
    if (message) {
      return `Chưa cập nhật được trạng thái ingest: ${message}`
    }
  }

  return 'Chưa cập nhật được trạng thái ingest. Kiểm tra API gateway hoặc đăng nhập lại rồi thử tiếp.'
}

function isSupportedUploadFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return (
    name.endsWith('.pdf') ||
    name.endsWith('.docx') ||
    name.endsWith('.pptx') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.txt')
  )
}

export default function DocsPage() {
  const currentUser = authApi.getUser()
  const isAdmin = isAdminLikeRole(currentUser?.roles)
  const isAnonymous = !authApi.isAuthenticated() || currentUser?.id === 'anonymous'

  const [activeTab, setActiveTab] = useState<'documents' | 'vungdulieu'>('documents')

  const [docs, setDocs] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pollWarning, setPollWarning] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCat, setSelectedCat] = useState('Tất cả')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCat, setUploadCat] = useState(UPLOAD_CATEGORIES[0])
  const [uploadSecurity, setUploadSecurity] = useState<SecurityLevel>('internal')
  const [uploadScope, setUploadScope] = useState<AccessScopeType>('all')
  const [uploadRoles, setUploadRoles] = useState<string[]>([])
  const [uploadDepartments, setUploadDepartments] = useState('')
  const [uploadUserIds, setUploadUserIds] = useState('')
  const [uploadPublication, setUploadPublication] = useState<PublicationStatus>('internal')
  const [uploadAiPolicy, setUploadAiPolicy] = useState<AiAccessPolicy>('allow')
  const [uploadExamType, setUploadExamType] = useState('practice')
  const [uploadExamStatus, setUploadExamStatus] = useState('upcoming')
    // Preview chunks modal
  const [previewDocId, setPreviewDocId] = useState<string | null>(null)
  const [previewChunks, setPreviewChunks] = useState<Array<{
    id: string
    text: string
    index: number
    section_path: string | null
    page: number | null
    created_at: string | null
  }>>([])
  const [previewTotal, setPreviewTotal] = useState(0)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const visiblePollWarning = pollWarning
    ? formatIngestPollWarning(new Error(pollWarning))
    : null
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadDocs = async () => {
    setLoading(true)
    setError(null)
    try {
      setDocs(await docsApi.list())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách tài liệu.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocs()
  }, [])

  const pendingIngestIds = useMemo(
    () =>
      docs
        .filter(
          (d) =>
            d.ingest_status === 'pending' || d.ingest_status === 'processing',
        )
        .map((d) => d.id),
    [docs],
  )
  const pendingIngestKey = useMemo(() => pendingIngestIds.join('|'), [pendingIngestIds])

  useEffect(() => {
    if (!pendingIngestKey) {
      setPollWarning(null)
      return
    }
    const ids = pendingIngestKey.split('|')

    let cancelled = false
    let timer: number | null = null
    let consecutiveFailures = 0

    const scheduleNext = (delay: number) => {
      timer = window.setTimeout(() => {
        void poll()
      }, delay)
    }

    const poll = async () => {
      try {
        const { documents } = await docsApi.ingestStatuses(ids)
        const updatesById = new Map(
          documents.map((status) => [
            status.document_id,
            {
              ingest_status: status.status,
              ingest_stage: status.stage,
              chunk_count: status.chunk_count,
              ingest_error: status.error,
            },
          ]),
        )
        setDocs((prev) => {
          let changed = false
          const next = prev.map((doc) => {
            const update = updatesById.get(doc.id)
            if (!update) return doc
            if (
              doc.ingest_status === update.ingest_status &&
              doc.ingest_stage === update.ingest_stage &&
              doc.chunk_count === update.chunk_count &&
              doc.ingest_error === update.ingest_error
            ) {
              return doc
            }
            changed = true
            return { ...doc, ...update }
          })
          return changed ? next : prev
        })
        if (cancelled) return
        consecutiveFailures = 0
        setPollWarning(null)
      } catch (error) {
        if (cancelled) return
        consecutiveFailures += 1
        if (consecutiveFailures >= INGEST_POLL_WARN_AFTER) {
          setPollWarning(error instanceof Error ? error.message : String(error))
        }
      } finally {
        if (cancelled) return
        const delay =
          consecutiveFailures === 0
            ? INGEST_POLL_BASE_MS
            : Math.min(
                INGEST_POLL_MAX_MS,
                INGEST_POLL_BASE_MS * 2 ** consecutiveFailures,
              )
        scheduleNext(delay)
      }
    }

    void poll()

    return () => {
      cancelled = true
      if (timer != null) window.clearTimeout(timer)
    }
  }, [pendingIngestKey])

  const categories = useMemo(() => {
    const set = new Set<string>()
    docs.forEach((d) => d.category && set.add(d.category))
    return ['Tất cả', ...Array.from(set)]
  }, [docs])

  const filteredDocs = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return docs.filter((doc) => {
      const matchesSearch =
        doc.title.toLowerCase().includes(term) ||
        doc.uploaded_by.toLowerCase().includes(term) ||
        doc.original_name.toLowerCase().includes(term)
      const matchesCat = selectedCat === 'Tất cả' || doc.category === selectedCat
      return matchesSearch && matchesCat
    })
  }, [docs, searchTerm, selectedCat])

  const onPickFile = () => fileInputRef.current?.click()

  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!isSupportedUploadFile(file)) {
      setPendingFile(null)
      setUploadOpen(false)
      setError(SUPPORTED_UPLOAD_MESSAGE)
      e.target.value = ''
      return
    }
    setPendingFile(file)
    setUploadTitle(file.name.replace(/\.[^.]+$/, ''))
    setUploadCat(UPLOAD_CATEGORIES[0])
    setUploadSecurity('internal')
    setUploadScope('all')
    setUploadRoles([])
    setUploadDepartments('')
    setUploadUserIds('')
    setUploadOpen(true)
    e.target.value = ''
  }

  const toggleRole = (code: string) => {
    setUploadRoles((prev) =>
      prev.includes(code) ? prev.filter((r) => r !== code) : [...prev, code],
    )
  }

  const submitUpload = async () => {
    if (!pendingFile) return
    if (!isSupportedUploadFile(pendingFile)) {
      setError(SUPPORTED_UPLOAD_MESSAGE)
      return
    }
    if (uploadScope === 'role' && uploadRoles.length === 0) {
      setError('Vui lòng chọn ít nhất một vai trò được xem.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const created = await docsApi.upload(pendingFile, {
        title: uploadTitle.trim() || undefined,
        category: uploadCat,
        access: {
          security_level: uploadSecurity,
          scope_type: uploadScope,
          role_codes: uploadScope === 'role' ? uploadRoles : undefined,
          department_codes:
            uploadScope === 'department'
              ? uploadDepartments.split(',').map((s) => s.trim()).filter(Boolean)
              : undefined,
          user_ids:
            uploadScope === 'custom'
              ? uploadUserIds.split(',').map((s) => s.trim()).filter(Boolean)
              : undefined,
        },
        security: {
          domain: uploadCat === 'Lịch thi' ? 'exam' : undefined,
          document_type: uploadCat === 'Lịch thi' ? 'exam' : undefined,
          publication_status: uploadPublication,
          ai_access_policy: uploadAiPolicy,
          domain_metadata:
            uploadCat === 'Lịch thi'
              ? { examType: uploadExamType, examStatus: uploadExamStatus }
              : undefined,
          tags: uploadCat === 'Lịch thi' ? ['exam'] : undefined,
        },
      })
      setDocs((prev) => [created, ...prev])
      setUploadOpen(false)
      setPendingFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải lên thất bại.')
    } finally {
      setUploading(false)
    }
  }

  const openDoc = async (doc: DocItem, download = false) => {
    setBusyId(doc.id)
    try {
      const blob = await docsApi.fetchBlob(doc.id)
      const url = URL.createObjectURL(blob)
      if (download) {
        const a = document.createElement('a')
        a.href = url
        a.download = doc.original_name
        a.click()
      } else {
        window.open(url, '_blank', 'noopener')
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không mở được tài liệu.')
    } finally {
      setBusyId(null)
    }
  }

  const deleteDoc = async (doc: DocItem) => {
    if (!confirm(`Xóa tài liệu "${doc.title}"?`)) return
    setBusyId(doc.id)
    try {
      await docsApi.remove(doc.id)
      setDocs((prev) => prev.filter((d) => d.id !== doc.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xóa thất bại.')
    } finally {
      setBusyId(null)
    }
  }

  const openPreview = async (doc: DocItem) => {
    setPreviewDocId(doc.id)
    setPreviewLoading(true)
    setPreviewChunks([])
    setPreviewTotal(0)
    try {
      const data = await docsApi.getChunks(doc.id, 5)
      setPreviewChunks(data.chunks)
      setPreviewTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải chunk preview.')
    } finally {
      setPreviewLoading(false)
    }
  }

  const canDelete = (doc: DocItem) =>
    isAdmin || doc.uploaded_by_id === currentUser?.id

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-6 md:p-8 overflow-y-auto">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.pptx,.xlsx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
        onChange={onFileChosen}
      />

      

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <BookOpen className="text-blue-600" />
            Tài liệu & Học liệu
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tra cứu và tải lên kho tài nguyên học tập, quy chế đào tạo nội bộ.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {isAnonymous
              ? 'Bạn đang xem với tư cách khách. Đăng nhập để tải lên và xem thêm.'
              : 'Hỗ trợ file PDF, DOCX, PPTX, XLSX và TXT để tải lên.'}
          </p>
        </div>

        {/* Show upload button only when authenticated AND on documents tab */}
        {activeTab === 'documents' && !isAnonymous && (
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-72 shrink-0">
              <input
                type="text"
                placeholder="Tìm kiếm tài liệu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.08)] transition-all text-slate-800 placeholder-slate-400 shadow-sm"
              />
              <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
            </div>
            <button
              type="button"
              onClick={onPickFile}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer shadow-md shadow-blue-600/10 transition-all"
            >
              <Upload size={16} />
              Tải lên
            </button>
          </div>
        )}

        {/* If anonymous and on documents tab, show login prompt instead of upload */}
        {activeTab === 'documents' && isAnonymous && (
          <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-100 px-4 py-2 rounded-xl">
            <LogIn size={16} className="text-blue-500" />
            <span>Đăng nhập để tải lên tài liệu</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 cursor-pointer ${
            activeTab === 'documents'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <FileText size={16} />
            Tài liệu
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
              {docs.length}
            </span>
          </span>
        </button>

        {/* Hide Vùng Dữ Liệu tab for anonymous users */}
        {!isAnonymous && (
          <button
            type="button"
            onClick={() => setActiveTab('vungdulieu')}
            className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 cursor-pointer ${
              activeTab === 'vungdulieu'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <BarChart3 size={16} />
              Vùng Dữ Liệu
            </span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'documents' ? (
        // ============================================================
        // DOCUMENTS TAB (your existing content)
        // ============================================================
        <>
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>
          )}

          {visiblePollWarning && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {visiblePollWarning}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mb-6 max-w-xl">
            {[
              { label: 'Tài liệu', value: docs.length, icon: FileText },
              { label: 'Danh mục', value: Math.max(categories.length - 1, 0), icon: FolderOpen },
              { label: 'Kết quả lọc', value: filteredDocs.length, icon: Filter },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white border border-slate-200/60 rounded-xl px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Icon size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
                </div>
                <p className="text-xl font-extrabold text-slate-800">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-4">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCat(cat)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  selectedCat === cat
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="animate-spin mb-2" size={24} />
              <p className="text-sm font-medium">Đang tải tài liệu…</p>
            </div>
          ) : filteredDocs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-200/60 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                      <FileText size={20} />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-500 uppercase tracking-wide">
                      {fileTypeLabel(doc.original_name)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">{doc.category}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${securityMeta(doc.security_level).badge}`}>
                      {securityMeta(doc.security_level).label}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${ingestMeta(doc.ingest_status).badge}`}>
                      {ingestMeta(doc.ingest_status).label}
                    </span>
                  </div>
                  <h3 className="text-slate-800 font-bold text-sm leading-snug group-hover:text-blue-600 transition-colors line-clamp-2 mb-3 min-h-[40px]">
                    {doc.title}
                  </h3>
                  {/* Ingest timeline */}
                  {doc.ingest_status && (
                    <div className="-mt-5 mb-2">
                      <div className="flex items-center gap-1">
                        {STAGE_ORDER.map((stage, idx) => {
                          const currentIndex = STAGE_ORDER.indexOf(doc.ingest_stage || 'queued')
                          const isDone = doc.ingest_status === 'completed'
                          const isActive = stage === doc.ingest_stage
                          const isPast = STAGE_ORDER.indexOf(stage) <= currentIndex
                          const isFailed = doc.ingest_status === 'failed'

                          return (
                            <React.Fragment key={stage}>
                              <div
                                className={`flex flex-col items-center flex-1 ${
                                  isFailed
                                    ? 'text-red-400'
                                    : isDone || isPast
                                    ? 'text-emerald-500'
                                    : isActive
                                    ? 'text-blue-500'
                                    : 'text-slate-300'
                                }`}
                              >
                                <div
                                  className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${
                                    isFailed
                                      ? 'border-red-400 bg-red-50'
                                      : isDone || isPast
                                      ? 'border-emerald-500 bg-emerald-50'
                                      : isActive
                                      ? 'border-blue-500 bg-blue-50'
                                      : 'border-slate-200 bg-slate-50'
                                  }`}
                                >
                                  {isFailed ? (
                                    <AlertCircle size={12} />
                                  ) : isDone || isPast ? (
                                    <CheckCircle size={12} />
                                  ) : isActive ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                                  )}
                                </div>
                                <span className="text-[8px] mt-0.5 whitespace-nowrap">
                                  {STAGE_LABELS[stage] || stage}
                                </span>
                              </div>
                              {idx < STAGE_ORDER.length - 1 && (
                                <div
                                  className={`h-0.5 flex-1 ${
                                    isFailed
                                      ? 'bg-red-200'
                                      : isDone || STAGE_ORDER.indexOf(stage) < currentIndex
                                      ? 'bg-emerald-300'
                                      : 'bg-slate-200'
                                  }`}
                                />
                              )}
                            </React.Fragment>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 mb-5 text-xs text-slate-400">
                    <div className="flex justify-between">
                      <span>Người tải</span>
                      <span className="font-semibold text-slate-600 truncate max-w-[60%]">{doc.uploaded_by}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ngày tải</span>
                      <span className="font-semibold text-slate-600">{formatDate(doc.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dung lượng</span>
                      <span className="font-semibold text-slate-600">{formatSize(doc.size)}</span>
                    </div>
                    {doc.ingest_status === 'completed' && (doc.chunk_count ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span>Chunks</span>
                        <span className="font-semibold text-emerald-600">{doc.chunk_count}</span>
                      </div>
                    )}
                    {doc.ingest_status === 'processing' && doc.ingest_stage && (
                      <div className="flex justify-between">
                        <span>Giai đoạn</span>
                        <span className="font-semibold text-amber-600">{doc.ingest_stage}</span>
                      </div>
                    )}
                    {doc.ingest_status === 'failed' && doc.ingest_error && (
                      <p className="text-red-500 text-[11px] leading-snug">{doc.ingest_error}</p>
                    )}
                  </div>

                  <div className="flex gap-2 mt-auto pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => openDoc(doc, false)}
                      disabled={busyId === doc.id || isAnonymous}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                      {busyId === doc.id ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                      Xem online
                    </button>
                    <button
                      type="button"
                      onClick={() => openPreview(doc)}
                      disabled={doc.ingest_status !== 'completed'}
                      title={doc.ingest_status === 'completed' ? 'Xem chunks' : 'Chưa có chunks'}
                      className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-all cursor-pointer disabled:opacity-40 disabled:hover:bg-slate-50 disabled:hover:text-slate-500"
                    >
                      <Eye size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openDoc(doc, true)}
                      disabled={busyId === doc.id}
                      title="Tải về"
                      className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Download size={13} />
                    </button>
                    {canDelete(doc) && (
                      <button
                        type="button"
                        onClick={() => deleteDoc(doc)}
                        disabled={busyId === doc.id}
                        title="Xóa"
                        className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-50 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white border border-slate-200/60 rounded-2xl shadow-sm">
              <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mb-3">
                {docs.length === 0 ? <Upload size={20} /> : <Filter size={20} />}
              </div>
              <p className="text-slate-600 font-bold text-sm">
                {docs.length === 0 ? 'Chưa có tài liệu nào' : 'Không tìm thấy tài liệu phù hợp'}
              </p>
              <p className="text-slate-400 text-xs mt-1">
                {docs.length === 0 ? 'Nhấn "Tải lên" để thêm tài liệu đầu tiên.' : 'Thử đổi từ khóa hoặc danh mục bộ lọc.'}
              </p>
            </div>
          )}
        </>
      ) : (
        // ============================================================
        // VÙNG DỮ LIỆU TAB (NEW)
        // ============================================================
        <VungDuLieuTab />
      )}

      {uploadOpen && pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">Tải lên tài liệu</h2>
              <button
                type="button"
                onClick={() => !uploading && setUploadOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <FileText size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">{pendingFile.name}</p>
                <p className="text-xs text-slate-400">{formatSize(pendingFile.size)}</p>
              </div>
            </div>

            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Tiêu đề</label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              className="w-full mb-4 bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-sm outline-none focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.08)] transition-all text-slate-800"
            />

            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Danh mục</label>
            <select
              value={uploadCat}
              onChange={(e) => setUploadCat(e.target.value)}
              className="w-full mb-4 bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-sm outline-none focus:border-blue-500 transition-all text-slate-800 cursor-pointer"
            >
              {UPLOAD_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Mức mật</label>
                <select
                  value={uploadSecurity}
                  onChange={(e) => setUploadSecurity(e.target.value as SecurityLevel)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-sm outline-none focus:border-blue-500 transition-all text-slate-800 cursor-pointer"
                >
                  {SECURITY_LEVELS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Đối tượng được xem</label>
                <select
                  value={uploadScope}
                  onChange={(e) => setUploadScope(e.target.value as AccessScopeType)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-sm outline-none focus:border-blue-500 transition-all text-slate-800 cursor-pointer"
                >
                  {SCOPE_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {uploadScope === 'role' && (
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Vai trò được xem</label>
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map((r) => (
                    <button
                      key={r.code}
                      type="button"
                      onClick={() => toggleRole(r.code)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        uploadRoles.includes(r.code)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {uploadScope === 'department' && (
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Mã đơn vị (phân tách bằng dấu phẩy)</label>
                <input
                  type="text"
                  value={uploadDepartments}
                  onChange={(e) => setUploadDepartments(e.target.value)}
                  placeholder="VD: P2, CNTT"
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-sm outline-none focus:border-blue-500 transition-all text-slate-800"
                />
              </div>
            )}

            {uploadScope === 'custom' && (
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Mã người dùng (phân tách bằng dấu phẩy)</label>
                <input
                  type="text"
                  value={uploadUserIds}
                  onChange={(e) => setUploadUserIds(e.target.value)}
                  placeholder="VD: USR001, USR002"
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-sm outline-none focus:border-blue-500 transition-all text-slate-800"
                />
              </div>
            )}

            {uploadScope === 'all' && <div className="mb-2" />}

            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Metadata bảo mật AI
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Trạng thái công bố</label>
                  <select
                    value={uploadPublication}
                    onChange={(e) => setUploadPublication(e.target.value as PublicationStatus)}
                    className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-sm outline-none focus:border-blue-500 text-slate-800"
                  >
                    {PUBLICATION_STATUSES.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Chính sách AI</label>
                  <select
                    value={uploadAiPolicy}
                    onChange={(e) => setUploadAiPolicy(e.target.value as AiAccessPolicy)}
                    className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-sm outline-none focus:border-blue-500 text-slate-800"
                  >
                    {AI_ACCESS_POLICIES.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {uploadCat === 'Lịch thi' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Loại đề (examType)</label>
                    <select
                      value={uploadExamType}
                      onChange={(e) => setUploadExamType(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-sm outline-none focus:border-blue-500 text-slate-800"
                    >
                      {EXAM_TYPE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Trạng thái (examStatus)</label>
                    <select
                      value={uploadExamStatus}
                      onChange={(e) => setUploadExamStatus(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-sm outline-none focus:border-blue-500 text-slate-800"
                    >
                      {EXAM_STATUS_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                disabled={uploading}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={submitUpload}
                disabled={uploading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-60"
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploading ? 'Đang tải lên…' : 'Tải lên'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Preview Chunks Modal */}
      {previewDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-xl border border-slate-200 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-lg font-bold text-slate-800">Chunk Preview</h2>
              <button
                type="button"
                onClick={() => {
                  setPreviewDocId(null)
                  setPreviewChunks([])
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-500 mb-4 shrink-0">
              <span>
                Hiển thị {previewChunks.length} / {previewTotal} chunks
              </span>
              {previewLoading && <Loader2 size={16} className="animate-spin" />}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {previewLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Loader2 className="animate-spin mr-2" size={20} />
                  Đang tải chunks...
                </div>
              ) : previewChunks.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Không có chunk nào để hiển thị.
                </div>
              ) : (
                previewChunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="border border-slate-200 rounded-xl p-4 bg-slate-50/50"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="font-mono">#{chunk.index}</span>
                      {chunk.section_path && (
                        <span className="truncate max-w-[60%]">
                          📂 {chunk.section_path}
                        </span>
                      )}
                      {chunk.page && (
                        <span>📄 Trang {chunk.page}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                      {chunk.text}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2 shrink-0 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setPreviewDocId(null)
                  setPreviewChunks([])
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-all cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
