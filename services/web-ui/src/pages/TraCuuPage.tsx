import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  ArrowUp,
  Calendar,
  ExternalLink,
  FileSearch,
  FileText,
  Info,
  Loader2,
  MessageSquareText,
  Search,
  Shield,
  User,
  X,
} from 'lucide-react'
import { chatApi, type ChatMessage } from '../api/chat'
import ChatMarkdown from '../components/ChatMarkdown'
import { docsApi, type DocItem } from '../api/docs'

const SECURITY_BADGE: Record<
  DocItem['security_level'],
  { label: string; className: string }
> = {
  public: { label: 'Công khai', className: 'bg-green-50 text-green-700' },
  internal: { label: 'Nội bộ', className: 'bg-blue-50 text-blue-700' },
  restricted: { label: 'Hạn chế', className: 'bg-amber-50 text-amber-700' },
  confidential: { label: 'Mật', className: 'bg-red-50 text-red-700' },
}

function normalizeText(str: string): string {
  return str
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

function highlightMatch(text: string, query: string) {
  const q = query.trim()
  if (!q) return text

  const idx = normalizeText(text).indexOf(normalizeText(q))
  if (idx === -1) return text

  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-yellow-100 px-0.5 text-slate-900">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}

function canInlinePreview(mimeType: string) {
  return (
    mimeType === 'application/pdf' ||
    mimeType.startsWith('image/') ||
    mimeType.startsWith('text/')
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function filterCitationsForDoc(
  citations: ChatMessage['citations'],
  docId: string,
) {
  if (!citations?.length) return []
  const normalizedDocId = docId.trim().toLowerCase()
  return citations.filter(
    (citation) => citation.doc_id?.trim().toLowerCase() === normalizedDocId,
  )
}

export default function TraCuuPage() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [docs, setDocs] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [assistantInput, setAssistantInput] = useState('')
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantMessages, setAssistantMessages] = useState<ChatMessage[]>([])
  const [assistantSessionId, setAssistantSessionId] = useState<string | null>(null)
  const assistantScrollRef = useRef<HTMLDivElement>(null)
  const assistantAbortRef = useRef<AbortController | null>(null)
  const assistantAutoScrollRef = useRef(true)

  const loadDocs = async () => {
    setLoading(true)
    setError(null)

    try {
      setDocs(await docsApi.list())
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không tải được danh sách tài liệu.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocs()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 280)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const container = assistantScrollRef.current
    if (!container || !assistantAutoScrollRef.current) return
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    })
  }, [assistantMessages, assistantLoading])

  useEffect(() => {
    return () => {
      assistantAbortRef.current?.abort()
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const filteredDocs = useMemo(() => {
    const term = normalizeText(debouncedQuery)
    if (!term) return []

    return docs
      .filter((doc) => normalizeText(doc.title).includes(term))
      .sort((a, b) => {
        const aStarts = normalizeText(a.title).startsWith(term) ? 0 : 1
        const bStarts = normalizeText(b.title).startsWith(term) ? 0 : 1
        return aStarts - bStarts
      })
  }, [debouncedQuery, docs])

  const hasQuery = query.trim().length > 0

  const openPreview = async (doc: DocItem) => {
    assistantAbortRef.current?.abort()
    assistantAutoScrollRef.current = true
    setPreviewDoc(doc)
    setPreviewLoading(true)
    setAssistantInput('')
    setAssistantLoading(false)
    setAssistantSessionId(null)
    setAssistantMessages([
      {
        id: `welcome-${doc.id}`,
        session_id: '',
        role: 'assistant',
        content:
          `Xin chào! Tôi là trợ lý ảo.\n\nTôi có thể giúp bạn tóm tắt, giải thích hoặc trả lời câu hỏi về tài liệu **${doc.title}**.`,
        created_at: new Date().toISOString(),
        status: 'completed',
      },
    ])
    setError(null)

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }

    try {
      const blob = await docsApi.fetchBlob(doc.id)
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể mở tài liệu gốc.')
    } finally {
      setPreviewLoading(false)
    }
  }

  const closePreview = () => {
    assistantAbortRef.current?.abort()
    assistantAutoScrollRef.current = true
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewDoc(null)
    setPreviewUrl(null)
    setPreviewLoading(false)
    setAssistantInput('')
    setAssistantLoading(false)
    setAssistantMessages([])
    setAssistantSessionId(null)
  }

  const openOriginalInNewTab = () => {
    if (!previewUrl) return
    window.open(previewUrl, '_blank', 'noopener')
  }

  const downloadDoc = async (doc: DocItem) => {
    setBusyId(doc.id)

    try {
      const blob = await docsApi.fetchBlob(doc.id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = doc.original_name
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được tài liệu.')
    } finally {
      setBusyId(null)
    }
  }

  const sendAssistantMessage = async () => {
    if (!previewDoc || !assistantInput.trim() || assistantLoading) return

    assistantAbortRef.current?.abort()
    assistantAutoScrollRef.current = true
    const controller = new AbortController()
    assistantAbortRef.current = controller

    const rawQuestion = assistantInput.trim()
    // Retrieval is now hard-scoped to this document (doc_ids below), so we send
    // the raw question — no need to inject a "prefer this document" instruction,
    // which only muddied the retrieval query.
    const content = rawQuestion

    const optimisticUser: ChatMessage = {
      id: `tmp-user-${Date.now()}`,
      session_id: assistantSessionId ?? '',
      role: 'user',
      content: rawQuestion,
      created_at: new Date().toISOString(),
      status: 'completed',
    }

    const tempAssistant: ChatMessage = {
      id: `tmp-assistant-${Date.now()}`,
      session_id: assistantSessionId ?? '',
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      status: 'loading',
    }

    setAssistantMessages((prev) => [...prev, optimisticUser, tempAssistant])
    setAssistantInput('')
    setAssistantLoading(true)

    let activeSessionId = assistantSessionId
    let assistantMessageId: string | null = null

    try {
      if (!activeSessionId) {
        const session = await chatApi.createSession(`Tra cứu: ${previewDoc.title}`)
        activeSessionId = session.id
        setAssistantSessionId(session.id)
      }

      await chatApi.streamMessage(
        activeSessionId,
        content,
        {
          onMeta: (meta) => {
            assistantMessageId = meta.assistant_message_id
            const filteredCitations = filterCitationsForDoc(
              meta.citations,
              previewDoc.id,
            )
            setAssistantMessages((prev) => {
              const filtered = prev.filter(
                (message) =>
                  message.id !== optimisticUser.id && message.id !== tempAssistant.id,
              )

              return [
                ...filtered,
                { ...meta.user_message, content: rawQuestion },
                {
                  id: meta.assistant_message_id,
                  session_id: activeSessionId!,
                  role: 'assistant',
                  content: '',
                  created_at: new Date().toISOString(),
                  citations: filteredCitations,
                  status: 'streaming',
                },
              ]
            })
          },
          onToken: (delta) => {
            setAssistantMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, content: `${message.content}${delta}`, status: 'streaming' }
                  : message,
              ),
            )
          },
          onDone: (result) => {
            const filteredAssistantMessage: ChatMessage = {
              ...result.assistant_message,
              citations: filterCitationsForDoc(
                result.assistant_message.citations,
                previewDoc.id,
              ),
            }
            setAssistantMessages((prev) => {
              const filtered = prev.filter((message) => message.id !== assistantMessageId)
              return [...filtered, filteredAssistantMessage]
            })
          },
          onError: (detail) => {
            setAssistantMessages((prev) => {
              const filtered = prev.filter(
                (message) =>
                  message.id !== tempAssistant.id && message.id !== assistantMessageId,
              )
              return [
                ...filtered,
                {
                  id: `err-${Date.now()}`,
                  session_id: activeSessionId ?? '',
                  role: 'assistant',
                  content: `Không thể gửi câu hỏi.\n\n${detail}`,
                  created_at: new Date().toISOString(),
                  error: true,
                  status: 'error',
                },
              ]
            })
          },
        },
        controller.signal,
        [previewDoc.id],
      )
    } catch (err) {
      if (!controller.signal.aborted) {
        const detail = err instanceof Error ? err.message : 'Lỗi không xác định'
        setAssistantMessages((prev) => {
          const filtered = prev.filter((message) => message.id !== tempAssistant.id)
          return [
            ...filtered,
            {
              id: `err-${Date.now()}`,
              session_id: activeSessionId ?? '',
              role: 'assistant',
              content: `Không thể gửi câu hỏi.\n\n${detail}`,
              created_at: new Date().toISOString(),
              error: true,
              status: 'error',
            },
          ]
        })
      }
    } finally {
      setAssistantLoading(false)
      assistantAbortRef.current = null
    }
  }

  const handleAssistantKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendAssistantMessage()
    }
  }

  const handleAssistantScroll = () => {
    const container = assistantScrollRef.current
    if (!container) return
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight
    assistantAutoScrollRef.current = distanceFromBottom < 48
  }

  return (
    <>
      <div className="flex h-full flex-col overflow-y-auto bg-slate-50/50 p-6 md:p-8">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-800">
            <Search className="text-blue-600" />
            Tra cứu tài liệu
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Nhập từ khóa để tìm tài liệu theo tên trong hệ thống.
          </p>
        </div>

        <div className="relative mx-auto w-3/4">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm tài liệu theo tên, ví dụ: quy chế đào tạo..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-11 text-sm text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.08)]"
          />
          {hasQuery && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600"
              title="Xóa"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mx-auto mt-6 w-3/4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 size={18} className="animate-spin" />
              Đang tìm kiếm…
            </div>
          ) : !hasQuery ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-400">
                <FileSearch size={26} />
              </div>
              <p className="text-sm text-slate-500">
                Nhập từ khóa vào ô trên để bắt đầu tra cứu tài liệu.
              </p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <FileSearch size={26} />
              </div>
              <p className="text-sm font-medium text-slate-600">
                Không tìm thấy tài liệu nào
              </p>
              <p className="text-xs text-slate-400">
                Thử từ khóa khác hoặc kiểm tra chính tả.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs font-medium text-slate-400">
                {filteredDocs.length} kết quả
              </p>
              <div className="space-y-2">
                {filteredDocs.map((doc) => {
                  const badge = SECURITY_BADGE[doc.security_level]

                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => openPreview(doc)}
                      className="group flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
                    >
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-blue-700">
                          {highlightMatch(doc.title, query)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${badge.className}`}
                          >
                            <Shield size={11} />
                            {badge.label}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <FileText size={12} />
                            {doc.category}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <User size={12} />
                            {doc.uploaded_by}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={12} />
                            {doc.created_at}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-100">
          <div className="flex h-full flex-col p-4">
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold text-slate-800">{previewDoc.title}</h2>
                <p className="mt-1 truncate text-sm text-slate-400">
                  {previewDoc.original_name}
                </p>
              </div>

              <div className="ml-4 flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={openOriginalInNewTab}
                  disabled={!previewUrl}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ExternalLink size={14} />
                  Mở tab mới
                </button>
                <button
                  type="button"
                  onClick={() => downloadDoc(previewDoc)}
                  disabled={busyId === previewDoc.id}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busyId === previewDoc.id ? 'Đang tải...' : 'Tải về'}
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <section className="min-h-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="h-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {previewLoading ? (
                    <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-400">
                      <Loader2 size={18} className="animate-spin" />
                      Đang tải file gốc...
                    </div>
                  ) : previewUrl ? (
                    canInlinePreview(previewDoc.mime_type) ? (
                      previewDoc.mime_type.startsWith('image/') ? (
                        <div className="flex h-full items-center justify-center overflow-auto p-4">
                          <img
                            src={previewUrl}
                            alt={previewDoc.title}
                            className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
                          />
                        </div>
                      ) : (
                        <iframe
                          src={previewUrl}
                          title={previewDoc.title}
                          className="h-full min-h-[70vh] w-full bg-white"
                        />
                      )
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                        <FileText className="text-slate-300" size={40} />
                        <p className="text-sm font-medium text-slate-600">
                          Trình duyệt không hỗ trợ xem trực tiếp định dạng này.
                        </p>
                        <p className="text-xs text-slate-400">
                          Bạn có thể mở file gốc ở tab mới hoặc tải xuống.
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">
                      Không thể tải file xem trước.
                    </div>
                  )}
                </div>
              </section>

              <aside className="flex h-full min-h-0 flex-col gap-4">
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 text-base font-bold uppercase tracking-wide text-indigo-500">
                    <Info size={18} />
                    Thông tin tài liệu
                  </div>

                  <div className="px-5 py-3">
                    {[
                      ['Loại tài liệu', previewDoc.category || '—'],
                      ['Mức bảo mật', SECURITY_BADGE[previewDoc.security_level].label],
                      ['Ngày vào kho', formatDate(previewDoc.created_at)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0"
                      >
                        <span className="text-sm text-slate-500">{label}</span>
                        <span className="max-w-[58%] text-right text-sm font-semibold text-slate-700">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 text-base font-bold uppercase tracking-wide text-indigo-500">
                    <MessageSquareText size={18} />
                    Tra cứu cùng trợ lý ảo
                  </div>

                  <div
                    ref={assistantScrollRef}
                    onScroll={handleAssistantScroll}
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
                  >
                    <div className="space-y-4">
                      {assistantMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.role === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {message.role === 'user' ? (
                            <div className="max-w-[88%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm">
                              {message.content}
                            </div>
                          ) : message.error ? (
                            <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                              {message.content}
                            </div>
                          ) : (
                            <div className="max-w-[92%]">
                              <div className="rounded-2xl rounded-bl-md bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                {message.status === 'loading' ||
                                (message.status === 'streaming' && !message.content) ? (
                                  <div className="flex items-center gap-1.5 py-1">
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:0ms]" />
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:150ms]" />
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:300ms]" />
                                  </div>
                                ) : (
                                  <ChatMarkdown content={message.content} />
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 px-4 py-3">
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 focus-within:border-blue-500 focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.08)]">
                      <textarea
                        value={assistantInput}
                        onChange={(e) => setAssistantInput(e.target.value)}
                        onKeyDown={handleAssistantKey}
                        placeholder="Nhập câu hỏi của bạn về tài liệu"
                        rows={1}
                        disabled={assistantLoading}
                        className="h-9 max-h-24 flex-1 resize-none bg-transparent py-2 text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => void sendAssistantMessage()}
                        disabled={!assistantInput.trim() || assistantLoading}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200"
                      >
                        {assistantLoading ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <ArrowUp size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </section>
              </aside>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
