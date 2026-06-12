import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { Send, BookOpen, Database, GraduationCap } from 'lucide-react'
import { sendMessage } from '../api/chat';

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
}

const suggestions = [
  { icon: GraduationCap, text: 'Lịch thi học kỳ 2 khi nào?' },
  { icon: BookOpen, text: 'Tóm tắt tài liệu môn Học máy' },
  { icon: Database, text: 'Điểm trung bình lớp CNTT-K65?' },
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const [loading, setLoading] = useState(false)

  const send = async (text?: string) => {
    const content = text || input
    if (!content.trim() || loading) return
  
    const userMsg: Message = { id: Date.now(), role: 'user', content }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
  
    try {
      const res = await sendMessage(content)
      const botMsg: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: res.answer,
      }
      setMessages(prev => [...prev, botMsg])
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Lỗi kết nối server. Vui lòng thử lại.',
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full bg-[#212121]">
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
            <div>
              <h2 className="text-2xl font-semibold text-white text-center">
                Xin chào! 👋
              </h2>
              <p className="text-white/50 text-center mt-1 text-sm">
                Tôi có thể giúp gì cho bạn hôm nay?
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-md">
              {suggestions.map(({ icon: Icon, text }) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => send(text)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 text-left transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center shrink-0">
                    <Icon size={15} className="text-blue-400" />
                  </div>
                  <span className="text-white/70 group-hover:text-white text-sm transition-colors">
                    {text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs shrink-0 mt-0.5">
                    AI
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-2.5 max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#2f2f2f] text-white/90 rounded-tr-sm'
                      : 'text-white/80'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs shrink-0 mt-0.5">
                  AI
                </div>
                <div className="flex items-center gap-1 px-4 py-3">
                  <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce [animation-delay:0ms]"></span>
                  <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce [animation-delay:150ms]"></span>
                  <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce [animation-delay:300ms]"></span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="px-4 pb-4 pt-2">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-2 bg-[#2f2f2f] rounded-2xl px-4 py-3 border border-white/10 focus-within:border-white/20 transition-colors">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Nhập câu hỏi..."
              rows={1}
              className="flex-1 bg-transparent text-white text-sm resize-none outline-none placeholder-white/30 max-h-32 leading-relaxed"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={!input.trim()}
              className="w-7 h-7 rounded-lg bg-white flex items-center justify-center hover:bg-white/90 disabled:opacity-20 disabled:cursor-not-allowed transition-all shrink-0 mb-0.5"
            >
              <Send size={13} className="text-black" />
            </button>
          </div>
          <p className="text-center text-[11px] text-white/25 mt-2">
            Trợ lý AI có thể mắc lỗi. Vui lòng kiểm tra thông tin quan trọng.
          </p>
        </div>
      </div>
    </div>
  )
}
