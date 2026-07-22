import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BookOpen, Database, Sparkles, Calendar, ArrowUp, Trash2, ThumbsUp, ThumbsDown } from 'lucide-react'
import { chatApi, type ChatMessage } from '../api/chat'
import { authApi } from '../api/auth'
import { useChatSessions } from '../contexts/ChatSessionContext'
import ChatMarkdown from '../components/ChatMarkdown'
import CitationList from '../components/CitationList'
import { useChatAssistantMode } from '../lib/chatAssistantMode'
import { useDocumentPreview } from '../hooks/useDocumentPreview'
import DocumentPreviewModal from '../components/DocumentPreviewModal'

const suggestions = [
  { icon: Calendar, text: 'Lịch thi học kỳ 2 khi nào?', category: 'Khảo thí' },
  { icon: BookOpen, text: 'Tóm tắt tài liệu môn Học máy', category: 'Học tập' },
  { icon: Database, text: 'Điểm thi lớp CNTT-K65?', category: 'Thống kê' },
]

export default function ChatPage() {
  const { sessionId } = useParams<{ sessionId?: string }>()
  const navigate = useNavigate()
  const { createSession, removeSession, upsertSession } = useChatSessions()
  const { mode } = useChatAssistantMode()
  const user = authApi.getUser()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [feedbackMap, setFeedbackMap] = useState<Map<string, 1 | -1>>(new Map())
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const skipLoadRef = useRef<string | null>(null)
  const pollingRef = useRef<number | null>(null)
  const isAdmin = user?.roles?.includes('ADMIN') ?? false
  const isCentralizedAssistant = mode === 'centralized'

  const { preview, openPreview, closePreview } = useDocumentPreview()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!isCentralizedAssistant) {
      setLoadingHistory(false)
      return
    }

    if (!sessionId) {
      setMessages([])
      setInput('')
      return
    }

    if (skipLoadRef.current === sessionId) {
      skipLoadRef.current = null
      return
    }

    let cancelled = false
    setMessages([])
    setInput('')
    setLoadingHistory(true)
    chatApi
      .listMessages(sessionId)
      .then((list) => {
        if (!cancelled) setMessages(list)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('Failed to load messages', err)
        setMessages([])
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false)
      })

    return () => {
      cancelled = true
    }
  }, [isCentralizedAssistant, sessionId])

  useEffect(() => {
    if (!isCentralizedAssistant) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    if (!sessionId) return

    const streamingMsg = messages.find((m) => m.status === 'streaming')
    if (!streamingMsg) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    if (pollingRef.current) return

    pollingRef.current = window.setInterval(async () => {
      try {
        const updatedMessages = await chatApi.listMessages(sessionId)
        const updated = updatedMessages.find((m) => m.id === streamingMsg.id)
        if (updated) {
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
          if (updated.status !== 'streaming') {
            if (pollingRef.current) {
              clearInterval(pollingRef.current)
              pollingRef.current = null
            }
          }
        }
      } catch (err) {
        console.warn('Polling error:', err)
      }
    }, 3000)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [isCentralizedAssistant, sessionId, messages])

  useEffect(() => {
    if (isCentralizedAssistant) return

    abortRef.current?.abort()
    setLoading(false)
  }, [isCentralizedAssistant])

  const send = async (text?: string) => {
    if (!isCentralizedAssistant) return

    const content = text || input
    if (!content.trim() || loading) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setInput('')

    const optimisticUser: ChatMessage = {
      id: `tmp-${Date.now()}`,
      session_id: sessionId ?? '',
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }

    const tempAssistant: ChatMessage = {
      id: `temp-assistant-${Date.now()}`,
      session_id: sessionId ?? '',
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      status: 'loading',
    }

    setMessages((prev) => [...prev, optimisticUser, tempAssistant])

    let assistantMessageId: string | null = null

    try {
      let activeId = sessionId
      if (!activeId) {
        const session = await createSession()
        activeId = session.id
      }

      await chatApi.streamMessage(
        activeId,
        content,
        {
          onMeta: (meta) => {
            setMessages((prev) => {
              const filtered = prev.filter(
                (m) => m.id !== optimisticUser.id && m.id !== tempAssistant.id,
              )
              const streamingAssistant: ChatMessage = {
                id: meta.assistant_message_id,
                session_id: activeId!,
                role: 'assistant',
                content: '',
                created_at: new Date().toISOString(),
                citations: meta.citations,
                status: 'streaming',
              }
              return [...filtered, meta.user_message, streamingAssistant]
            })
            assistantMessageId = meta.assistant_message_id
          },
          onToken: (delta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId && m.status === 'streaming'
                  ? { ...m, content: m.content + delta }
                  : m,
              ),
            )
          },
          onDone: (result) => {
            setMessages((prev) => {
              const filtered = prev.filter((m) => m.id !== assistantMessageId)
              return [...filtered, result.assistant_message]
            })
            upsertSession(result.session)
            if (!sessionId) {
              skipLoadRef.current = activeId!
              navigate(`/chat/${activeId}`, { replace: true })
            }
          },
          onError: (detail) => {
            setMessages((prev) => {
              const filtered = prev.filter(
                (m) => m.id !== assistantMessageId && m.id !== tempAssistant.id,
              )
              return [
                ...filtered,
                {
                  id: `err-${Date.now()}`,
                  session_id: activeId ?? '',
                  role: 'assistant',
                  content: `Không thể gửi tin nhắn.\n\n${detail}`,
                  created_at: new Date().toISOString(),
                  error: true,
                },
              ]
            })
          },
        },
        controller.signal,
      )
    } catch (err) {
      if (controller.signal.aborted) return
      const detail = err instanceof Error ? err.message : 'Lỗi không xác định'
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== assistantMessageId && m.id !== tempAssistant.id)
          .concat({
            id: `err-${Date.now()}`,
            session_id: sessionId ?? '',
            role: 'assistant',
            content: `Không thể gửi tin nhắn.\n\n${detail}`,
            created_at: new Date().toISOString(),
            error: true,
          }),
      )
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  const handleDeleteSession = async () => {
    if (!sessionId) return
    const confirmed = window.confirm(
      'Bạn có chắc muốn xóa hội thoại này không?\n\nToàn bộ tin nhắn sẽ bị xóa vĩnh viễn và không thể khôi phục.',
    )
    if (!confirmed) return
    await removeSession(sessionId)
    navigate('/chat')
  }

  const handleFeedback = useCallback(
    async (msg: ChatMessage, rating: 1 | -1) => {
      if (!sessionId || !msg.id) return
      setFeedbackMap((prev) => new Map(prev).set(msg.id, rating))
      const chunkIds = (msg.citations ?? []).map((c) => c.chunk_id).filter(Boolean)
      try {
        await chatApi.submitFeedback(sessionId, msg.id, rating, chunkIds)
      } catch {
        // revert optimistic update on failure
        setFeedbackMap((prev) => {
          const next = new Map(prev)
          next.delete(msg.id)
          return next
        })
      }
    },
    [sessionId],
  )

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const isEmpty = messages.length === 0 && !loadingHistory
  const displayName = user?.full_name?.split(' ').slice(-1)[0] ?? user?.username ?? 'bạn'
  const modeLabel = isCentralizedAssistant ? 'Trợ lý ảo tập trung' : 'Trợ lý ảo cá nhân'

  return (
    <div className="flex h-full flex-col bg-slate-50/50" data-testid="chat-page">
      <div className="flex h-15 shrink-0 items-center justify-between border-b border-slate-200/60 bg-white/85 px-6 shadow-[0_1px_3px_rgba(0,0,0,0.01)] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isCentralizedAssistant ? 'animate-pulse bg-emerald-500' : 'bg-amber-400'
            }`}
          />
          <span className="text-sm font-bold text-slate-700">EduMind Assistant</span>
          {user?.roles[0] && (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {user.roles[0]}
            </span>
          )}
          <div className="ml-2 hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 sm:flex">
            <span className="text-[11px] font-semibold text-slate-500">Chế độ:</span>
            <span className="text-sm font-semibold text-slate-700">{modeLabel}</span>
          </div>
        </div>

        {isCentralizedAssistant && sessionId && messages.length > 0 && (
          <button
            type="button"
            onClick={handleDeleteSession}
            data-testid="chat-delete-session"
            className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-red-500"
          >
            <Trash2 size={14} />
            Xóa hội thoại
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!isCentralizedAssistant ? (
          <div className="flex min-h-full items-center justify-center px-6 py-12">
            <div className="w-full max-w-xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                <Sparkles size={26} />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-800">
                Trợ lý ảo cá nhân
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Tính năng này hiện đang phát triển. Tạm thời bạn vẫn có thể dùng đầy đủ luồng chat hiện tại trong chế độ Trợ lý ảo tập trung.
              </p>
            </div>
          </div>
        ) : loadingHistory ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Đang tải hội thoại...
          </div>
        ) : isEmpty ? (
          <div className="relative flex min-h-full flex-col items-center justify-center gap-8 overflow-hidden px-6 py-12">
            <div
              className="pointer-events-none absolute z-0 h-[500px] w-[800px] rounded-full animate-glow-in"
              style={{
                top: '45%',
                left: '50%',
                background:
                  'radial-gradient(circle, rgba(59, 130, 246, 0.38) 0%, rgba(147, 197, 253, 0.16) 50%, rgba(255, 255, 255, 0) 80%)',
                filter: 'blur(75px)',
              }}
            />

            <div className="relative z-10 max-w-lg text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-100/30 bg-blue-50/80 text-blue-600 shadow-sm backdrop-blur-sm">
                <Sparkles size={28} />
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">
                Xin chào, {displayName}!
              </h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500 md:text-base">
                Trợ lý AI học viện, thông tin đáng tin cậy từ kho tri thức nội bộ.
              </p>
            </div>

            <div className="relative z-10 mt-4 grid w-full max-w-3xl grid-cols-1 gap-3.5 md:grid-cols-3">
              {suggestions.map(({ icon: Icon, text, category }) => (
                <div
                  key={text}
                  role="button"
                  tabIndex={0}
                  data-testid="chat-suggestion"
                  onClick={() => send(text)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') send(text)
                  }}
                  className="group flex min-w-0 cursor-pointer select-none flex-col items-start rounded-2xl border border-slate-200/60 bg-white/90 px-6 py-5 text-left shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50/20 hover:shadow-md"
                >
                  <div className="mb-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100">
                    <Icon size={16} />
                  </div>
                  <span className="mb-1.5 w-full text-[10px] font-bold uppercase text-slate-400">
                    {category}
                  </span>
                  <span className="w-full break-words text-sm font-semibold leading-snug text-slate-700 group-hover:text-slate-900">
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
            {messages.map((msg) => (
              <div
                key={msg.id}
                data-testid={`chat-message-${msg.role}`}
                className={`flex w-full gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white shadow-sm">
                    AI
                  </div>
                )}

                {msg.role === 'user' ? (
                  <div className="max-w-[80%] rounded-2xl rounded-tr-none bg-blue-600 px-4 py-3 text-sm font-medium leading-relaxed whitespace-pre-wrap text-white shadow-sm">
                    {msg.content}
                  </div>
                ) : msg.error ? (
                  <div className="flex min-w-0 max-w-[80%] flex-1 flex-col gap-1">
                    <div className="rounded-2xl rounded-tl-none border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-relaxed whitespace-pre-wrap text-red-700 shadow-sm">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex min-w-0 max-w-[80%] flex-1 flex-col gap-1">
                    <div className="rounded-2xl rounded-tl-none border border-slate-200/50 bg-white px-4 py-3 text-slate-800 shadow-sm">
                      {msg.status === 'loading' || (msg.status === 'streaming' && !msg.content) ? (
                        <div className="flex items-center gap-1.5 py-1">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:0ms]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:150ms]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:300ms]" />
                        </div>
                      ) : (
                        <ChatMarkdown content={msg.content} />
                      )}
                    </div>
                    {!msg.error &&
                      msg.citations &&
                      msg.citations.length > 0 &&
                      msg.status !== 'streaming' &&
                      msg.status !== 'loading' && (
                        <CitationList
                          citations={msg.citations}
                          showScores={isAdmin}
                          onCitationClick={(citation) => {
                            if (citation.doc_id) {
                              openPreview(
                                citation.doc_id,
                                citation.title,
                                citation.original_name,
                                citation.mime_type,
                                citation.chunk_id
                              )
                            }
                          }}
                        />
                      )}
                    {!msg.error &&
                      msg.status !== 'streaming' &&
                      msg.status !== 'loading' && (
                        <div className="flex items-center gap-1 pt-0.5">
                          <button
                            type="button"
                            aria-label="Câu trả lời hữu ích"
                            onClick={() => handleFeedback(msg, 1)}
                            className={`rounded-lg p-1.5 transition-colors ${feedbackMap.get(msg.id) === 1 ? 'text-green-600' : 'text-slate-300 hover:text-slate-500'}`}
                          >
                            <ThumbsUp size={14} />
                          </button>
                          <button
                            type="button"
                            aria-label="Câu trả lời không hữu ích"
                            onClick={() => handleFeedback(msg, -1)}
                            className={`rounded-lg p-1.5 transition-colors ${feedbackMap.get(msg.id) === -1 ? 'text-red-500' : 'text-slate-300 hover:text-slate-500'}`}
                          >
                            <ThumbsDown size={14} />
                          </button>
                        </div>
                      )}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 pb-6 pt-2">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 flex items-center justify-end sm:hidden">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
              <span className="font-semibold text-slate-500">Chế độ: </span>
              <span className="font-semibold text-slate-700">{modeLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm transition-all focus-within:border-blue-500 focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.08)]">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              data-testid="chat-input"
              aria-label="Chat input"
              placeholder={
                isCentralizedAssistant
                  ? 'Nhập câu hỏi tại đây...'
                  : 'Trợ lý ảo cá nhân đang phát triển'
              }
              rows={1}
              disabled={!isCentralizedAssistant || loadingHistory || loading}
              className="min-h-[24px] max-h-32 flex-1 resize-none bg-transparent text-sm leading-relaxed text-slate-800 outline-none placeholder-slate-400"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={!isCentralizedAssistant || !input.trim() || loading || loadingHistory}
              data-testid="chat-send"
              aria-label="Send message"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/10 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:shadow-none"
            >
              <ArrowUp size={16} />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] font-medium text-slate-400">
            {isCentralizedAssistant
              ? 'Trợ lý có thể đưa ra câu trả lời chưa chính xác. Vui lòng kiểm chứng thông tin quan trọng.'
              : 'Trợ lý ảo cá nhân đang được phát triển và sẽ sớm được cập nhật.'}
          </p>
        </div>
      </div>

      <DocumentPreviewModal preview={preview} onClose={closePreview} />
    </div>
  )
}
