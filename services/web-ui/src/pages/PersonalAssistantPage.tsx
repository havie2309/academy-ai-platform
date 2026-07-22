import { useEffect, useState, type FormEvent } from 'react'
import { Folder, FolderPlus, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { personalFoldersApi, type PersonalFolder } from '../api/personalFolders'
import { setStoredChatAssistantMode } from '../lib/chatAssistantMode'

export default function PersonalAssistantPage() {
  const navigate = useNavigate()
  const [folders, setFolders] = useState<PersonalFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      setFolders(await personalFoldersApi.list())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách folder.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setStoredChatAssistantMode('personal')
    void load()
  }, [])

  const createFolder = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || saving) return
    try {
      setSaving(true)
      const folder = await personalFoldersApi.create(name, description)
      setShowCreate(false)
      setName('')
      setDescription('')
      navigate(`/personal-assistant/${folder.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tạo folder.')
    } finally {
      setSaving(false)
    }
  }

  const removeFolder = async (event: React.MouseEvent, folder: PersonalFolder) => {
    event.stopPropagation()
    if (!window.confirm(`Xóa folder “${folder.name}”?`)) return
    try {
      await personalFoldersApi.remove(folder.id)
      setFolders((current) => current.filter((item) => item.id !== folder.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xóa folder.')
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50/60">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-600">
              <ShieldCheck size={17} /> Không gian riêng tư theo tài khoản
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Trợ lý ảo cá nhân</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Tạo folder, tải tài liệu cá nhân và hỏi đáp trong đúng phạm vi folder đã chọn.
              Folder và nội dung bên trong chỉ thuộc tài khoản của bạn.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus size={17} /> Tạo folder
          </button>
        </div>

        {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 className="mr-2 animate-spin" /> Đang tải...</div>
        ) : folders.length === 0 ? (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex w-full flex-col items-center rounded-3xl border-2 border-dashed border-slate-200 bg-white px-6 py-20 text-center transition hover:border-blue-300 hover:bg-blue-50/20"
          >
            <div className="mb-4 rounded-2xl bg-blue-50 p-4 text-blue-600"><FolderPlus size={30} /></div>
            <span className="text-lg font-bold text-slate-800">Tạo folder đầu tiên</span>
            <span className="mt-2 text-sm text-slate-500">Mỗi folder là một vùng kiến thức riêng cho trợ lý của bạn.</span>
          </button>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => navigate(`/personal-assistant/${folder.id}`)}
                className="group relative rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div className="mb-5 flex items-start justify-between">
                  <div className="rounded-xl bg-blue-50 p-3 text-blue-600"><Folder size={24} fill="currentColor" className="fill-blue-100" /></div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => void removeFolder(event, folder)}
                    className="rounded-lg p-2 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    title="Xóa folder"
                  ><Trash2 size={15} /></span>
                </div>
                <h2 className="truncate text-base font-bold text-slate-800">{folder.name}</h2>
                <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">{folder.description || 'Chưa có mô tả'}</p>
                <div className="mt-5 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-400">
                  {folder.document_count} tài liệu
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
          <form onSubmit={createFolder} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900">Tạo folder cá nhân</h2>
            <p className="mt-1 text-sm text-slate-500">Tài liệu trong folder chỉ được dùng cho tài khoản của bạn.</p>
            <label className="mt-5 block text-sm font-semibold text-slate-700">Tên folder</label>
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" placeholder="Ví dụ: Luận văn cao học" />
            <label className="mt-4 block text-sm font-semibold text-slate-700">Mô tả (không bắt buộc)</label>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">Hủy</button>
              <button disabled={!name.trim() || saving} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
                {saving && <Loader2 size={15} className="animate-spin" />} Tạo folder
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
