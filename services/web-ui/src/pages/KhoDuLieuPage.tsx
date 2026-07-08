import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Database,
  FileText,
  Filter,
  Info,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import {
  requestsApi,
  type RequestListItem,
  type RequestDetail,
  type RequestStatus,
  type RequestUploadDetail,
} from '../api/requests'

// ─── Constants ────────────────────────────────────────────────────────────────

type ZoneId = 'dt' | 'kt' | 'qs' | 'vn' | 'tv'

interface Zone {
  id: ZoneId
  name: string
  color: string
}

const ZONES: Zone[] = [
  { id: 'dt', name: 'Quản lý Đào tạo',              color: '#F59E0B' },
  { id: 'kt', name: 'Quản lý Khảo thí & ĐBCL',      color: '#3B82F6' },
  { id: 'qs', name: 'Khoa học quân sự',              color: '#10B981' },
  { id: 'vn', name: 'Viện nghiên cứu khoa học',      color: '#8B5CF6' },
  { id: 'tv', name: 'Thư viện',                      color: '#EC4899' },
]

const DOC_TYPES = [
  'Biểu mẫu',
  'Tài liệu thu thập từ các nguồn',
  'Giáo trình, tài liệu dạy học',
  'Đề tài, chuyên đề',
  'Tạp chí',
]

const STATUS_CONFIG: Record<RequestStatus, { label: string; cls: string; dot: string }> = {
  pending:    { label: 'Chờ duyệt',  cls: 'bg-amber-50 text-amber-700 border border-amber-200',      dot: 'bg-amber-400' },
  processing: { label: 'Đang xử lý', cls: 'bg-blue-50 text-blue-700 border border-blue-200',         dot: 'bg-blue-500' },
  done:       { label: 'Hoàn thành', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
  rejected:   { label: 'Từ chối',    cls: 'bg-red-50 text-red-700 border border-red-200',            dot: 'bg-red-500' },
}

const PAGE_SIZE = 8

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const yy = d.getFullYear()
    return `${hh}:${mm} ${dd}/${mo}/${yy}`
  } catch {
    return iso
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RequestStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

interface FileRow {
  file: File
  code: string
  name: string
  author: string
  country: string
  published: string
  org: string
  field: string
  level: string
}

function UploadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [docType, setDocType] = useState(DOC_TYPES[0])
  const [zone, setZone] = useState<ZoneId>('dt')
  const [desc, setDesc] = useState('')
  const [rows, setRows] = useState<FileRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const newRows: FileRow[] = Array.from(files).map((f) => ({
      file: f,
      code: '',
      name: f.name.replace(/\.[^.]+$/, ''),
      author: '',
      country: '',
      published: '',
      org: '',
      field: '',
      level: 'Nội bộ',
    }))
    setRows((prev) => [...prev, ...newRows])
  }

  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i))

  const updateRow = (i: number, key: keyof Omit<FileRow, 'file'>, val: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)))

  const handleSubmit = async () => {
    if (!rows.length) { setError('Vui lòng chọn ít nhất một file.'); return }
    setSaving(true)
    setError('')
    try {
      await requestsApi.create(
        rows.map((r) => r.file),
        {
          type: docType,
          zone,
          desc,
          filesMeta: rows.map((r) => ({
            code: r.code, name: r.name, author: r.author,
            country: r.country, published: r.published, org: r.org,
            field: r.field, level: r.level,
          })),
        },
      )
      onCreated()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Kho dữ liệu tập trung</p>
              <p className="mt-0.5 text-base font-bold text-slate-800">Tạo yêu cầu cập nhật dữ liệu</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Loại tài liệu *</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Vùng dữ liệu *</label>
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value as ZoneId)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  {ZONES.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Mô tả</label>
                <input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Mô tả ngắn về lô tài liệu này…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* Drop zone */}
            <div
              className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 text-center transition-colors hover:border-blue-300 hover:bg-blue-50"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
            >
              <Upload size={24} className="text-slate-400" />
              <p className="text-sm font-medium text-slate-600">Kéo file vào đây hoặc <span className="text-blue-600">chọn file</span></p>
              <p className="text-xs text-slate-400">PDF, DOCX, XLSX, TXT — tối đa 20 file</p>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>

            {/* File rows */}
            {rows.length > 0 && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {['File', 'Số hiệu VB', 'Tên/tiêu đề', 'Tác giả', 'Cấp độ mật', ''].map((h) => (
                          <th key={h} className="border-b border-slate-100 px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-b border-slate-50 last:border-0">
                          <td className="px-3 py-2 max-w-[120px]">
                            <span className="truncate block text-slate-500">📎 {r.file.name}</span>
                          </td>
                          {(['code', 'name', 'author'] as const).map((k) => (
                            <td key={k} className="px-2 py-2">
                              <input
                                value={r[k]}
                                onChange={(e) => updateRow(i, k, e.target.value)}
                                className="w-full min-w-[80px] rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                              />
                            </td>
                          ))}
                          <td className="px-2 py-2">
                            <select
                              value={r.level}
                              onChange={(e) => updateRow(i, 'level', e.target.value)}
                              className="rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
                            >
                              {['Công khai', 'Nội bộ', 'Hạn chế', 'Mật'].map((l) => <option key={l}>{l}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <button
                              onClick={() => removeRow(i)}
                              className="flex h-6 w-6 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-red-500"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-slate-100 px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || rows.length === 0}
              className="flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <FileText size={13} />}
              {saving ? 'Đang gửi…' : 'Gửi yêu cầu'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  item,
  onClose,
  onRefresh,
}: {
  item: RequestListItem
  onClose: () => void
  onRefresh: () => void
}) {
  const [detail, setDetail] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    requestsApi.get(item.id)
      .then(setDetail)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Lỗi tải chi tiết'))
      .finally(() => setLoading(false))
  }, [item.id])

  const zone = ZONES.find((z) => z.id === (detail?.zone ?? item.zone))

  const handleApprove = async () => {
    setApproving(true)
    setError('')
    try {
      await requestsApi.approve(item.id)
      onRefresh()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi phê duyệt')
    } finally {
      setApproving(false)
    }
  }

  const handleReject = async () => {
    setRejecting(true)
    setError('')
    try {
      await requestsApi.reject(item.id, rejectReason)
      onRefresh()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Lỗi từ chối')
    } finally {
      setRejecting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-[660px] max-w-full flex-col bg-slate-50 shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Chi tiết yêu cầu</p>
            <p className="mt-0.5 text-base font-bold text-slate-800">{item.requestId || item.id}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-slate-400" />
            </div>
          ) : detail ? (
            <>
              {/* General info */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-100 px-5 py-3.5">
                  <p className="text-sm font-semibold text-slate-800">Thông tin chung</p>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-4 p-5">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Mã yêu cầu</label>
                    <input readOnly value={detail.requestId} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Loại tài liệu</label>
                    <input readOnly value={detail.type} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Vùng dữ liệu</label>
                    <input readOnly value={zone?.name ?? detail.zone} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Trạng thái</label>
                    <div className="pt-1.5"><StatusBadge status={detail.status} /></div>
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Mô tả</label>
                    <input readOnly value={detail.desc} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Người tạo</label>
                    <input readOnly value={detail.createdBy.username} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Ngày tạo</label>
                    <input readOnly value={fmtDate(detail.createdAt)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500" />
                  </div>
                </div>
              </div>

              {/* Hint */}
              <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5">
                <Info size={15} className="mt-0.5 shrink-0 text-blue-500" />
                <p className="text-[13px] italic leading-relaxed text-blue-700">
                  Sau khi được phê duyệt, hệ thống sẽ tự động phân tích, xử lý và lưu trữ từng file vào Kho Dữ Liệu Tập Trung.
                </p>
              </div>

              {/* File table */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-100 px-5 py-3.5">
                  <p className="text-sm font-semibold text-slate-800">Danh sách file ({(detail.uploads ?? []).length})</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Số hiệu VB', 'Tên/tiêu đề', 'Tác giả', 'Cấp độ mật', 'File', 'Ingest'].map((h) => (
                          <th key={h} className="border-b border-slate-100 px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-slate-500 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.uploads ?? []).map((u: RequestUploadDetail) => (
                        <tr key={u.fileId} className="border-b border-slate-50 last:border-0">
                          <td className="px-3 py-2 text-slate-600">{u.code || '—'}</td>
                          <td className="px-3 py-2 max-w-[160px]"><span className="truncate block">{u.name || u.originalName}</span></td>
                          <td className="px-3 py-2 text-slate-500">{u.author || '—'}</td>
                          <td className="px-3 py-2 text-slate-500">{u.level || '—'}</td>
                          <td className="px-3 py-2">
                            <span className="text-xs font-medium text-blue-600">📎 {u.originalName}</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-[11px] font-semibold ${
                              u.ingestStatus === 'done' ? 'text-emerald-600' :
                              u.ingestStatus === 'failed' ? 'text-red-500' :
                              u.ingestStatus === 'processing' ? 'text-blue-600' :
                              'text-slate-400'
                            }`}>
                              {u.ingestStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {detail.uploads.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-slate-400">Chưa có file nào</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Reject input */}
              {showRejectInput && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
                  <p className="text-sm font-semibold text-red-700">Lý do từ chối</p>
                  <input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Nhập lý do từ chối (tùy chọn)…"
                    className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowRejectInput(false)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={rejecting}
                      className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {rejecting && <Loader2 size={12} className="animate-spin" />}
                      Xác nhận từ chối
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
              )}
            </>
          ) : (
            <p className="py-16 text-center text-sm text-slate-400">Không tìm thấy dữ liệu</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-slate-200 bg-white px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Đóng
          </button>
          {detail?.status === 'pending' && !showRejectInput && (
            <>
              <button
                onClick={() => setShowRejectInput(true)}
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
              >
                Từ chối
              </button>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {approving && <Loader2 size={13} className="animate-spin" />}
                Phê duyệt
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Filter panel ─────────────────────────────────────────────────────────────

function FilterPanel({
  open,
  typeFilters,
  statusFilters,
  onTypeChange,
  onStatusChange,
  onReset,
  onClose,
}: {
  open: boolean
  typeFilters: Set<string>
  statusFilters: Set<RequestStatus>
  onTypeChange: (v: string) => void
  onStatusChange: (v: RequestStatus) => void
  onReset: () => void
  onClose: () => void
}) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30" onClick={onClose} />}
      <div
        className={`fixed right-0 top-0 z-40 flex h-full w-72 flex-col border-l border-slate-200 bg-white shadow-xl transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <p className="text-sm font-bold text-slate-800">Bộ lọc</p>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Loại tài liệu</p>
            <div className="space-y-1.5">
              {DOC_TYPES.map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                  <input type="checkbox" checked={typeFilters.has(t)} onChange={() => onTypeChange(t)} className="accent-blue-600" />
                  {t}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Trạng thái</p>
            <div className="space-y-1.5">
              {(Object.entries(STATUS_CONFIG) as [RequestStatus, typeof STATUS_CONFIG[RequestStatus]][]).map(([k, v]) => (
                <label key={k} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                  <input type="checkbox" checked={statusFilters.has(k)} onChange={() => onStatusChange(k)} className="accent-blue-600" />
                  {v.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2.5 border-t border-slate-100 p-4">
          <button onClick={onReset} className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Đặt lại</button>
          <button onClick={onClose} className="flex-1 rounded-lg bg-blue-900 py-2 text-sm font-semibold text-white hover:bg-blue-800">Áp dụng</button>
        </div>
      </div>
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function KhoDuLieuPage() {
  const [docs, setDocs] = useState<RequestListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeZone, setActiveZone] = useState<ZoneId | null>(null)
  const [zonePanelWidth, setZonePanelWidth] = useState(248)
  const [activeTab, setActiveTab] = useState<'update' | 'approval'>('update')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<RequestListItem | null>(null)
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set())
  const [statusFilters, setStatusFilters] = useState<Set<RequestStatus>>(new Set())
  const [showUploadModal, setShowUploadModal] = useState(false)

  // ── Resize zone panel ────────────────────────────────────────────────────────
  const onZoneResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = zonePanelWidth
    const onMove = (mv: globalThis.MouseEvent) => {
      setZonePanelWidth(Math.max(140, Math.min(320, startW + mv.clientX - startX)))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // ── Load data ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await requestsApi.list()
      setDocs(data)
    } catch {
      // leave existing data on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Zone counts (derived from live data) ──────────────────────────────────────
  const zoneCounts = useMemo(() => {
    const map: Record<string, number> = {}
    docs.forEach((d) => { map[d.zone] = (map[d.zone] ?? 0) + 1 })
    return map
  }, [docs])

  // ── Filtering ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return docs.filter((d) => {
      if (activeZone && d.zone !== activeZone) return false
      if (q && !d.requestId?.toLowerCase().includes(q) && !d.id.toLowerCase().includes(q) && !d.desc.toLowerCase().includes(q) && !d.type.toLowerCase().includes(q)) return false
      if (typeFilters.size && !typeFilters.has(d.type)) return false
      if (statusFilters.size && !statusFilters.has(d.status)) return false
      return true
    })
  }, [docs, activeZone, search, typeFilters, statusFilters])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const pendingDocs = docs.filter((d) => d.status === 'pending')

  const goPage = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)))

  const handleZone = (id: ZoneId) => {
    setActiveZone((prev) => (prev === id ? null : id))
    setPage(1)
  }

  const toggleType = (v: string) => {
    setTypeFilters((prev) => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n })
    setPage(1)
  }

  const toggleStatus = (v: RequestStatus) => {
    setStatusFilters((prev) => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n })
    setPage(1)
  }

  const resetFilters = () => { setTypeFilters(new Set()); setStatusFilters(new Set()); setPage(1) }

  const pageNums = useMemo(() => {
    const nums: (number | '…')[] = []
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - safePage) <= 1) nums.push(i)
      else if (nums[nums.length - 1] !== '…') nums.push('…')
    }
    return nums
  }, [totalPages, safePage])

  // ── Inline approve/reject (approval tab quick actions) ───────────────────────
  const quickApprove = async (id: string) => {
    try {
      await requestsApi.approve(id)
      await load()
    } catch {
      // silent; user can open detail for full error
    }
  }

  const quickReject = async (id: string) => {
    try {
      await requestsApi.reject(id)
      await load()
    } catch {
      // silent
    }
  }

  const [syncingId, setSyncingId] = useState<string | null>(null)
  const quickSync = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setSyncingId(id)
    try {
      await requestsApi.syncStatus(id)
      await load()
    } catch {
      // silent
    } finally {
      setSyncingId(null)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden bg-slate-50/50">
      {/* ── Zone sidebar ────────────────────────────────────────────────────── */}
      <aside
        style={{ width: zonePanelWidth }}
        className="relative flex shrink-0 flex-col border-r border-slate-200/80 bg-white"
      >
        <div
          onMouseDown={onZoneResizeStart}
          className="absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize hover:bg-blue-400/30 active:bg-blue-400/50"
        />

        <div className="px-4 pb-3 pt-5">
          <div className="flex items-center gap-2.5">
            <Database size={17} className="text-blue-600" />
            <p className="text-base font-bold text-slate-800">Kho dữ liệu</p>
          </div>
        </div>

        <div className="px-3 pb-2">
          <p className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Vùng dữ liệu</p>
          <div className="space-y-1">
            {ZONES.map((z) => (
              <button
                key={z.id}
                onClick={() => handleZone(z.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] font-medium transition-all ${
                  activeZone === z.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: z.color }} />
                <span className="flex-1 leading-snug">{z.name}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                  activeZone === z.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {zoneCounts[z.id] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Page header */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-slate-200 bg-white px-6 py-4">
          <Database size={17} className="text-slate-400" />
          <h1 className="text-base font-bold text-slate-800">
            {activeZone ? ZONES.find((z) => z.id === activeZone)?.name : 'Kho dữ liệu tập trung'}
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-slate-200 bg-white px-6">
          {(['update', 'approval'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab === 'update' ? 'Cập nhật dữ liệu' : 'Phê duyệt'}
              {tab === 'approval' && pendingDocs.length > 0 && (
                <span className="ml-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-600">
                  {pendingDocs.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'update' ? (
            <div className="flex flex-col gap-4">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative min-w-[180px] max-w-md flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                    placeholder="Tìm kiếm theo mã / tiêu đề…"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  <Plus size={14} /> Thêm mới
                </button>
                <button
                  onClick={() => { setSearch(''); resetFilters(); load() }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-blue-600"
                  title="Làm mới"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                </button>
                <button
                  onClick={() => setFilterOpen((o) => !o)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                    filterOpen || typeFilters.size > 0 || statusFilters.size > 0
                      ? 'border-blue-300 bg-blue-50 text-blue-600'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-blue-600'
                  }`}
                  title="Lọc"
                >
                  <Filter size={14} />
                </button>
              </div>

              {/* Table */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="w-10 border-b border-slate-200 px-4 py-3 text-left">
                          <input type="checkbox" className="accent-blue-600" />
                        </th>
                        {['Mã yêu cầu', 'Loại tài liệu', 'Mô tả', 'Số file', 'Trạng thái', 'Ngày tạo', 'Tạo bởi', ''].map((h) => (
                          <th key={h} className="border-b border-slate-200 px-3 py-3 text-left text-[11.5px] font-semibold tracking-wide text-slate-500">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {loading && docs.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-16 text-center">
                            <Loader2 size={20} className="mx-auto animate-spin text-slate-400" />
                          </td>
                        </tr>
                      ) : pageRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-16 text-center text-sm text-slate-400">
                            Không có dữ liệu phù hợp
                          </td>
                        </tr>
                      ) : (
                        pageRows.map((d) => (
                          <tr
                            key={d.id}
                            onClick={() => setDetailItem(d)}
                            className="cursor-pointer transition-colors hover:bg-blue-50/40"
                          >
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" className="accent-blue-600" />
                            </td>
                            <td className="px-3 py-3">
                              <span className="font-mono text-xs font-semibold text-blue-600">{d.requestId || d.id}</span>
                            </td>
                            <td className="max-w-[160px] px-3 py-3">
                              <span className="truncate block text-[13px] text-slate-700">{d.type}</span>
                            </td>
                            <td className="max-w-[180px] px-3 py-3">
                              <span className="truncate block text-[13px] text-slate-500">{d.desc || '—'}</span>
                            </td>
                            <td className="px-3 py-3 text-center tabular-nums text-[13px] text-slate-600">{d.files}</td>
                            <td className="px-3 py-3"><StatusBadge status={d.status} /></td>
                            <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-slate-500">{fmtDate(d.createdAt)}</td>
                            <td className="px-3 py-3 text-[13px] text-slate-600">{d.by}</td>
                            <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                {d.status === 'processing' && (
                                  <button
                                    onClick={(e) => quickSync(e, d.id)}
                                    disabled={syncingId === d.id}
                                    title="Đồng bộ trạng thái"
                                    className="flex h-7 w-7 items-center justify-center rounded text-blue-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40"
                                  >
                                    {syncingId === d.id
                                      ? <Loader2 size={13} className="animate-spin" />
                                      : <RotateCcw size={13} />}
                                  </button>
                                )}
                                <button className="flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-slate-100 hover:text-slate-600">
                                  <MoreVertical size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
                  <p className="text-xs text-slate-500 tabular-nums">
                    Hiển thị {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} / {filtered.length} yêu cầu
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => goPage(safePage - 1)}
                      disabled={safePage === 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >‹</button>
                    {pageNums.map((p, i) =>
                      p === '…' ? (
                        <span key={`e${i}`} className="px-1 text-slate-400">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => goPage(p)}
                          className={`flex h-8 min-w-[32px] items-center justify-center rounded-lg border px-2 text-sm tabular-nums transition-colors ${
                            p === safePage
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >{p}</button>
                      )
                    )}
                    <button
                      onClick={() => goPage(safePage + 1)}
                      disabled={safePage === totalPages}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >›</button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── Approval tab ─────────────────────────────────────────────── */
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-5 py-3.5">
                <p className="text-sm font-semibold text-slate-800">Yêu cầu chờ phê duyệt</p>
              </div>
              {loading && pendingDocs.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={20} className="animate-spin text-slate-400" />
                </div>
              ) : pendingDocs.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-400">Không có yêu cầu nào chờ phê duyệt</div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {pendingDocs.map((d) => {
                    const z = ZONES.find((z) => z.id === d.zone)
                    return (
                      <div
                        key={d.id}
                        className="flex cursor-pointer items-center gap-4 px-5 py-3.5 transition-colors hover:bg-blue-50/40"
                        onClick={() => setDetailItem(d)}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                          <Database size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs font-semibold text-blue-600">{d.requestId || d.id}</p>
                          <p className="mt-0.5 truncate text-[13px] text-slate-500">
                            {d.type}{d.desc ? ` · ${d.desc}` : ''}
                          </p>
                        </div>
                        <div className="shrink-0">
                          <p className="text-xs text-slate-400">{z?.name}</p>
                          <p className="text-right text-xs tabular-nums text-slate-400">{fmtDate(d.createdAt)}</p>
                        </div>
                        <div className="flex shrink-0 gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => quickApprove(d.id)}
                            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                          >
                            Duyệt
                          </button>
                          <button
                            onClick={() => quickReject(d.id)}
                            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                          >
                            Từ chối
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Filter panel ──────────────────────────────────────────────────────── */}
      <FilterPanel
        open={filterOpen}
        typeFilters={typeFilters}
        statusFilters={statusFilters}
        onTypeChange={toggleType}
        onStatusChange={toggleStatus}
        onReset={resetFilters}
        onClose={() => setFilterOpen(false)}
      />

      {/* ── Detail panel ──────────────────────────────────────────────────────── */}
      {detailItem && (
        <DetailPanel
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onRefresh={load}
        />
      )}

      {/* ── Upload modal ──────────────────────────────────────────────────────── */}
      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onCreated={load}
        />
      )}
    </div>
  )
}
