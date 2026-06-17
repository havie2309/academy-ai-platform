import { useEffect, useMemo, useRef, useState } from 'react'
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
} from 'lucide-react'
import {
  docsApi,
  type DocItem,
  type IngestStatus,
  type SecurityLevel,
  type AccessScopeType,
} from '../api/docs'
import { authApi } from '../api/auth'

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

export default function DocsPage() {
  const currentUser = authApi.getUser()
  const isAdmin = currentUser?.roles?.some((r) =>
    ['Admin', 'BGD', 'P2'].includes(r),
  )

  const [docs, setDocs] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
  const [uploading, setUploading] = useState(false)
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

  useEffect(() => {
    if (pendingIngestIds.length === 0) return

    const timer = window.setInterval(async () => {
      try {
        const updates = await Promise.all(
          pendingIngestIds.map(async (id) => {
            const s = await docsApi.ingestStatus(id)
            return {
              id,
              ingest_status: s.status,
              ingest_stage: s.stage,
              chunk_count: s.chunk_count,
              ingest_error: s.error,
            }
          }),
        )
        setDocs((prev) =>
          prev.map((doc) => {
            const u = updates.find((x) => x.id === doc.id)
            return u ? { ...doc, ...u } : doc
          }),
        )
      } catch {
        // ignore polling errors
      }
    }, 3000)

    return () => window.clearInterval(timer)
  }, [pendingIngestIds])

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

  const canDelete = (doc: DocItem) =>
    isAdmin || doc.uploaded_by_id === currentUser?.id

  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-6 md:p-8 overflow-y-auto">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv"
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
        </div>

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
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600 cursor-pointer">
            <X size={16} />
          </button>
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
                  disabled={busyId === doc.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {busyId === doc.id ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                  Xem online
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

            {uploadScope === 'all' && <div className="mb-6" />}

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
    </div>
  )
}
