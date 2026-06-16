import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BookOpen, Database, Sparkles, Calendar, ArrowUp, Trash2 } from 'lucide-react'
import { chatApi, type ChatMessage } from '../api/chat'
import { authApi } from '../api/auth'
import { useChatSessions } from '../contexts/ChatSessionContext'
import ChatMarkdown from '../components/ChatMarkdown'
import CitationList from '../components/CitationList'

const STREAMING_ID = 'streaming-assistant'

const suggestions = [
  { icon: Calendar, text: 'Lịch thi học kỳ 2 khi nào?', category: 'Khảo thí' },
  { icon: BookOpen, text: 'Tóm tắt tài liệu môn Học máy', category: 'Học tập' },
  { icon: Database, text: 'Điểm thi lớp CNTT-K65?', category: 'Thống kê' },
]

export default function ChatPage() {
  const { sessionId } = useParams<{ sessionId?: string }>()
  const navigate = useNavigate()
  const { createSession, removeSession, upsertSession } = useChatSessions()
  const user = authApi.getUser()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const skipLoadRef = useRef<string | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
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
  }, [sessionId])

  const send = async (text?: string) => {
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

    const streamingAssistant: ChatMessage = {
      id: STREAMING_ID,
      session_id: sessionId ?? '',
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      citations: [],
    }

    setMessages((prev) => [...prev, optimisticUser, streamingAssistant])

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
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === optimisticUser.id) return meta.user_message
                if (m.id === STREAMING_ID) {
                  return { ...m, session_id: activeId!, citations: meta.citations }
                }
                return m
              }),
            )
          },
          onToken: (delta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === STREAMING_ID ? { ...m, content: m.content + delta } : m,
              ),
            )
          },
          onDone: (result) => {
            setMessages((prev) =>
              prev
                .filter((m) => m.id !== STREAMING_ID)
                .concat(result.assistant_message),
            )
            upsertSession(result.session)
            if (!sessionId) {
              skipLoadRef.current = activeId!
              navigate(`/chat/${activeId}`, { replace: true })
            }
          },
          onError: (detail) => {
            setMessages((prev) =>
              prev
                .filter((m) => m.id !== STREAMING_ID)
                .concat({
                  id: `err-${Date.now()}`,
                  session_id: activeId ?? '',
                  role: 'assistant',
                  content: `Không thể gửi tin nhắn.\n\n${detail}`,
                  created_at: new Date().toISOString(),
                  error: true,
                }),
            )
          },
        },
        controller.signal,
      )
    } catch (err) {
      if (controller.signal.aborted) return
      const detail = err instanceof Error ? err.message : 'Lỗi không xác định'
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== STREAMING_ID)
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
    await removeSession(sessionId)
    navigate('/chat')
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const isEmpty = messages.length === 0 && !loadingHistory
  const displayName = user?.full_name?.split(' ').slice(-1)[0] ?? user?.username ?? 'bạn'
  const isStreaming = messages.some((m) => m.id === STREAMING_ID)

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="h-15 border-b border-slate-200/60 bg-white/85 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-bold text-slate-700">EduMind Assistant</span>
          {user?.roles[0] && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
              {user.roles[0]}
            </span>
          )}
        </div>
        {sessionId && messages.length > 0 && (
          <button
            type="button"
            onClick={handleDeleteSession}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
          >
            <Trash2 size={14} />
            Xóa hội thoại
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-400">
            Đang tải hội thoại…
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center min-h-full gap-8 px-6 py-12 relative overflow-hidden">
            <div
              className="absolute w-[800px] h-[500px] rounded-full pointer-events-none z-0 animate-glow-in"
              style={{
                top: '45%',
                left: '50%',
                background:
                  'radial-gradient(circle, rgba(59, 130, 246, 0.38) 0%, rgba(147, 197, 253, 0.16) 50%, rgba(255, 255, 255, 0) 80%)',
                filter: 'blur(75px)',
              }}
            />

            <div className="text-center max-w-lg relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-blue-50/80 backdrop-blur-sm text-blue-600 flex items-center justify-center mx-auto mb-4 shadow-sm border border-blue-100/30">
                <Sparkles size={28} />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">
                Xin chào, {displayName}!
              </h2>
              <p className="text-slate-500 mt-2 text-sm md:text-base leading-relaxed font-medium">
                Trợ lý AI học viện — thông tin đáng tin cậy từ kho tri thức nội bộ.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 w-full max-w-3xl mt-4 relative z-10">
              {suggestions.map(({ icon: Icon, text, category }) => (
                <div
                  key={text}
                  role="button"
                  tabIndex={0}
                  onClick={() => send(text)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') send(text)
                  }}
                  className="flex w-full min-w-0 flex-col items-start rounded-2xl border border-slate-200/60 bg-white/90 backdrop-blur-sm px-6 py-5 text-left shadow-sm transition-all select-none cursor-pointer hover:border-blue-200 hover:bg-blue-50/20 hover:shadow-md group"
                >
                  <div className="mb-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100">
                    <Icon size={16} />
                  </div>
                  <span className="mb-1.5 w-full text-[10px] font-bold uppercase text-slate-400">{category}</span>
                  <span className="w-full break-words text-sm font-semibold leading-snug text-slate-700 group-hover:text-slate-900">
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm ${msg.error ? 'bg-red-500' : 'bg-blue-600'}`}
                  >
                    AI
                  </div>
                )}

                {msg.role === 'user' ? (
                  <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm bg-blue-600 text-white rounded-tr-none font-medium max-w-[80%]">
                    {msg.content}
                  </div>
                ) : msg.error ? (
                  <div className="flex flex-col max-w-[80%] gap-1 min-w-0 flex-1">
                    <div className="rounded-2xl px-4 py-3 shadow-sm bg-red-50 text-red-700 border border-red-200 rounded-tl-none text-sm leading-relaxed whitespace-pre-wrap font-medium">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col max-w-[80%] gap-1 min-w-0 flex-1">
                    <div className="rounded-2xl px-4 py-3 shadow-sm bg-white text-slate-800 border border-slate-200/50 rounded-tl-none">
                      {msg.content ? (
                        <ChatMarkdown content={msg.content} />
                      ) : (
                        <div className="flex items-center gap-1.5 py-1">
                          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0ms]" />
                          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:150ms]" />
                          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:300ms]" />
                        </div>
                      )}
                    </div>
                    {msg.citations && msg.citations.length > 0 && (
                      <CitationList citations={msg.citations} />
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && !isStreaming && (
              <div className="flex gap-4 justify-start">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
                  AI
                </div>
                <div className="flex items-center gap-1.5 px-4 py-3 bg-white border border-slate-200/50 rounded-2xl rounded-tl-none shadow-sm">
                  <span className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 pb-6 pt-2">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm transition-all focus-within:border-blue-500 focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.08)]">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Nhập câu hỏi tại đây..."
              rows={1}
              disabled={loadingHistory || loading}
              className="flex-1 bg-transparent text-slate-800 text-sm resize-none outline-none placeholder-slate-400 max-h-32 leading-relaxed min-h-[24px]"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={!input.trim() || loading || loadingHistory}
              className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white flex items-center justify-center transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed shadow-md shadow-blue-600/10 disabled:shadow-none"
            >
              <ArrowUp size={16} />
            </button>
          </div>
          <p className="text-center text-[11px] text-slate-400 mt-2 font-medium">
            Trợ lý có thể đưa ra câu trả lời chưa chính xác. Vui lòng kiểm chứng thông tin quan trọng.
          </p>
        </div>
      </div>
    </div>
  )
}

