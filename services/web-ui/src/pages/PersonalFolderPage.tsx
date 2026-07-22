import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import {
  ArrowLeft,
  ArrowUp,
  FileText,
  FolderLock,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { chatApi, type ChatMessage, type ChatSession } from '../api/chat'
import { docsApi, type DocItem } from '../api/docs'
import { personalFoldersApi, type PersonalFolder } from '../api/personalFolders'
import ChatMarkdown from '../components/ChatMarkdown'
import CitationList from '../components/CitationList'
import { setStoredChatAssistantMode } from '../lib/chatAssistantMode'

function ingestLabel(doc: DocItem) {
  if (doc.ingest_status === 'completed') return 'Sẵn sàng'
  if (doc.ingest_status === 'failed') return 'Lỗi xử lý'
  if (doc.ingest_status === 'processing') return `Đang xử lý${doc.ingest_stage ? ` · ${doc.ingest_stage}` : ''}`
  return 'Đang chờ xử lý'
}

export default function PersonalFolderPage() {
  const { folderId = '', personalSessionId } = useParams<{ folderId: string; personalSessionId?: string }>()
  const navigate = useNavigate()
  const [folder, setFolder] = useState<PersonalFolder | null>(null)
  const [documents, setDocuments] = useState<DocItem[]>([])
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const loadWorkspace = async () => {
    const [folderData, docsData, sessionsData] = await Promise.all([
      personalFoldersApi.get(folderId),
      personalFoldersApi.listDocuments(folderId),
      chatApi.listSessions(folderId),
    ])
    setFolder(folderData)
    setDocuments(docsData)
    setSessions(sessionsData)
  }

  useEffect(() => {
    setStoredChatAssistantMode('personal')
    let cancelled = false
    setLoading(true)
    loadWorkspace()
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Không thể tải folder.'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [folderId])

  useEffect(() => {
    if (!documents.some((doc) => doc.ingest_status === 'pending' || doc.ingest_status === 'processing')) return
    const timer = window.setInterval(() => {
      personalFoldersApi.listDocuments(folderId).then(setDocuments).catch(() => undefined)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [documents, folderId])

  useEffect(() => {
    abortRef.current?.abort()
    if (!personalSessionId) {
      setMessages([])
      setLoadingMessages(false)
      return
    }
    let cancelled = false
    setLoadingMessages(true)
    chatApi.listMessages(personalSessionId)
      .then((items) => !cancelled && setMessages(items))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Không thể tải lịch sử chat.'))
      .finally(() => !cancelled && setLoadingMessages(false))
    return () => { cancelled = true }
  }, [personalSessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setUploading(true)
      setError('')
      const doc = await personalFoldersApi.uploadDocument(folderId, file)
      setDocuments((current) => [doc, ...current])
      setFolder((current) => current ? { ...current, document_count: current.document_count + 1 } : current)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải file lên.')
    } finally {
      setUploading(false)
    }
  }

  const removeDocument = async (doc: DocItem) => {
    if (!window.confirm(`Xóa tài liệu “${doc.title}” khỏi folder?`)) return
    try {
      await docsApi.remove(doc.id)
      setDocuments((current) => current.filter((item) => item.id !== doc.id))
      setFolder((current) => current ? { ...current, document_count: Math.max(0, current.document_count - 1) } : current)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xóa tài liệu.')
    }
  }

  const newChat = () => {
    abortRef.current?.abort()
    setMessages([])
    setInput('')
    navigate(`/personal-assistant/${folderId}`)
  }

  const removeSession = async (session: ChatSession) => {
    if (!window.confirm(`Xóa hội thoại “${session.title}”?`)) return
    try {
      await chatApi.deleteSession(session.id)
      setSessions((current) => current.filter((item) => item.id !== session.id))
      if (personalSessionId === session.id) newChat()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xóa hội thoại.')
    }
  }

  const send = async () => {
    const content = input.trim()
    if (!content || sending || loadingMessages) return
    const readyDocs = documents.filter((doc) => doc.ingest_status === 'completed')
    if (readyDocs.length === 0) {
      setError('Folder cần ít nhất một tài liệu đã xử lý xong trước khi hỏi đáp.')
      return
    }
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    setSending(true)
    setInput('')
    setError('')

    let activeId = personalSessionId
    const optimisticUser: ChatMessage = {
      id: `user-${Date.now()}`,
      session_id: activeId ?? '',
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    const optimisticAssistant: ChatMessage = {
      id: `assistant-${Date.now()}`,
      session_id: activeId ?? '',
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      status: 'loading',
    }
    setMessages((current) => [...current, optimisticUser, optimisticAssistant])
    let assistantId = optimisticAssistant.id

    try {
      if (!activeId) {
        const session = await chatApi.createSession(`Hỏi đáp · ${folder?.name ?? 'Folder cá nhân'}`, folderId)
        activeId = session.id
        setSessions((current) => [session, ...current])
      }
      await chatApi.streamMessage(
        activeId,
        content,
        {
          onMeta: (meta) => {
            assistantId = meta.assistant_message_id
            setMessages((current) => [
              ...current.filter((item) => item.id !== optimisticUser.id && item.id !== optimisticAssistant.id),
              meta.user_message,
              {
                id: assistantId,
                session_id: activeId!,
                role: 'assistant',
                content: '',
                created_at: new Date().toISOString(),
                citations: meta.citations,
                status: 'streaming',
              },
            ])
          },
          onToken: (delta) => setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: item.content + delta, status: 'streaming' } : item)),
          onDone: (result) => {
            setMessages((current) => [...current.filter((item) => item.id !== assistantId), result.assistant_message])
            setSessions((current) => [result.session, ...current.filter((item) => item.id !== result.session.id)])
            if (!personalSessionId) navigate(`/personal-assistant/${folderId}/chat/${activeId}`, { replace: true })
          },
          onError: (message) => {
            setMessages((current) => [...current.filter((item) => item.id !== assistantId && item.id !== optimisticAssistant.id), {
              id: `error-${Date.now()}`,
              session_id: activeId!,
              role: 'assistant',
              content: message,
              created_at: new Date().toISOString(),
              error: true,
            }])
          },
        },
        controller.signal,
      )
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Không thể gửi câu hỏi.')
    } finally {
      setSending(false)
      abortRef.current = null
    }
  }

  const handleKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }

  if (loading) return <div className="flex h-full items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" /> Đang mở folder...</div>

  return (
    <div className="flex h-full min-w-0 flex-col bg-slate-50/60">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => navigate('/personal-assistant')} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ArrowLeft size={18} /></button>
          <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><FolderLock size={20} /></div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-slate-900">{folder?.name}</h1>
            <p className="flex items-center gap-1 text-xs text-slate-500"><ShieldCheck size={12} /> Chỉ tài khoản của bạn · {documents.length} tài liệu</p>
          </div>
        </div>
        <button onClick={newChat} className="flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700"><MessageSquarePlus size={16} /> Chat mới</button>
      </header>

      {error && <div className="mx-4 mt-3 shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4 lg:block">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Tài liệu trong folder</h2>
            <button disabled={uploading} onClick={() => fileInputRef.current?.click()} className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50" title="Tải file lên"><Upload size={16} /></button>
          </div>
          <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.docx,.pptx,.xlsx,.txt" onChange={upload} />
          <button disabled={uploading} onClick={() => fileInputRef.current?.click()} className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-200 bg-blue-50/50 px-3 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50">
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />} {uploading ? 'Đang tải...' : 'Thêm file'}
          </button>
          <div className="space-y-2">
            {documents.length === 0 && <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-xs text-slate-400">Chưa có tài liệu</p>}
            {documents.map((doc) => (
              <div key={doc.id} className="group rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="flex gap-2">
                  <FileText size={16} className="mt-0.5 shrink-0 text-blue-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-700" title={doc.title}>{doc.title}</p>
                    <p className={`mt-1 text-[10px] font-semibold ${doc.ingest_status === 'completed' ? 'text-emerald-600' : doc.ingest_status === 'failed' ? 'text-red-500' : 'text-amber-600'}`}>{ingestLabel(doc)}</p>
                  </div>
                  <button onClick={() => void removeDocument(doc)} className="self-start rounded p-1 text-slate-300 opacity-0 hover:text-red-500 group-hover:opacity-100"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
            {loadingMessages ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400"><Loader2 size={18} className="mr-2 animate-spin" /> Đang tải lịch sử...</div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 rounded-2xl bg-blue-50 p-4 text-blue-600"><FolderLock size={30} /></div>
                <h2 className="text-xl font-bold text-slate-800">Hỏi đáp trong “{folder?.name}”</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Trợ lý chỉ tìm kiếm và trả lời từ các tài liệu đã xử lý xong trong folder này.</p>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-5">
                {messages.map((message) => (
                  <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {message.role === 'assistant' && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">AI</div>}
                    <div className={`min-w-0 max-w-[82%] ${message.role === 'assistant' ? 'flex-1' : ''}`}>
                      <div className={`rounded-2xl px-4 py-3 text-sm ${message.role === 'user' ? 'rounded-tr-none bg-blue-600 text-white' : message.error ? 'rounded-tl-none border border-red-200 bg-red-50 text-red-700' : 'rounded-tl-none border border-slate-200 bg-white text-slate-800'}`}>
                        {(message.status === 'loading' || (message.status === 'streaming' && !message.content)) ? <Loader2 size={16} className="animate-spin text-blue-500" /> : message.role === 'assistant' && !message.error ? <ChatMarkdown content={message.content} /> : <span className="whitespace-pre-wrap">{message.content}</span>}
                      </div>
                      {message.citations?.length && message.status !== 'streaming' ? <CitationList citations={message.citations} /> : null}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4">
            <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-slate-200 px-4 py-2 shadow-sm focus-within:border-blue-500">
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKey} rows={1} disabled={sending || loadingMessages} placeholder="Hỏi về các tài liệu trong folder..." className="max-h-32 min-h-8 flex-1 resize-none bg-transparent py-1 text-sm outline-none" />
              <button onClick={() => void send()} disabled={!input.trim() || sending} className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white disabled:bg-slate-200"><ArrowUp size={16} /></button>
            </div>
            <p className="mt-2 text-center text-[10px] font-medium text-slate-400">Phạm vi trả lời được khóa ở folder hiện tại.</p>
          </div>
        </main>

        <aside className="hidden w-64 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4 xl:block">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Lịch sử trong folder</h2>
          <div className="space-y-1">
            {sessions.length === 0 && <p className="py-5 text-center text-xs text-slate-400">Chưa có hội thoại</p>}
            {sessions.map((session) => (
              <div key={session.id} className="group relative">
                <button onClick={() => navigate(`/personal-assistant/${folderId}/chat/${session.id}`)} className={`w-full truncate rounded-lg px-3 py-2.5 pr-8 text-left text-xs font-semibold ${personalSessionId === session.id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>{session.title}</button>
                <button onClick={() => void removeSession(session)} className="absolute right-1 top-1.5 rounded p-1 text-slate-300 opacity-0 hover:text-red-500 group-hover:opacity-100"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
