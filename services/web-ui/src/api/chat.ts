import { fetchWithAuth } from './http'

async function parseError(res: Response): Promise<string> {
  if (res.status === 401) {
    return 'Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng xuất và đăng nhập lại.'
  }
  const body = await res.json().catch(() => ({}))
  const msg = (body as { message?: string | string[] }).message
  if (Array.isArray(msg)) return msg.join(', ')
  return msg ?? `Lỗi API (${res.status})`
}

export interface ChatCitation {
  doc_id: string
  chunk_id: string
  title: string
  page?: number
  snippet: string
  source: string
  section_path?: string
  rerank_score?: number
  security_level?: string
  vector_score?: number
}

export interface ChatSession {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
  citations?: ChatCitation[]
  route?: string
  error?: boolean
  status?: 'loading' | 'streaming' | 'completed' | 'error'
}

export interface StreamDonePayload {
  session: ChatSession
  assistant_message: ChatMessage
  citations: ChatCitation[]
  route: string
}

export interface StreamMetaPayload {
  user_message: ChatMessage
  citations: ChatCitation[]
  route: string
  assistant_message_id: string
}

export interface StreamHandlers {
  onMeta: (meta: StreamMetaPayload) => void
  onToken: (delta: string) => void
  onDone: (result: StreamDonePayload) => void
  onError: (message: string) => void
}

function parseSseBlock(
  block: string,
): { event: string; data: string } | null {
  const lines = block.split('\n').filter(Boolean)
  if (!lines.length) return null
  let event = 'message'
  const dataLines: string[] = []
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  if (!dataLines.length) return null
  return { event, data: dataLines.join('\n') }
}

export const chatApi = {
  async listSessions(): Promise<ChatSession[]> {
    const res = await fetchWithAuth('/api/chat/sessions', {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(await parseError(res))
    const data = await res.json()
    return Array.isArray(data) ? data : []
  },

  async createSession(title?: string): Promise<ChatSession> {
    const res = await fetchWithAuth('/api/chat/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async deleteSession(sessionId: string): Promise<void> {
    const res = await fetchWithAuth(`/api/chat/sessions/${sessionId}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error(await parseError(res))
  },

  async listMessages(sessionId: string): Promise<ChatMessage[]> {
    const res = await fetchWithAuth(`/api/chat/sessions/${sessionId}/messages`)
    if (!res.ok) throw new Error(await parseError(res))
    return res.json()
  },

  async streamMessage(
    sessionId: string,
    content: string,
    handlers: StreamHandlers,
    signal?: AbortSignal,
    docIds?: string[],
  ): Promise<void> {
    const res = await fetchWithAuth(`/api/chat/sessions/${sessionId}/messages/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        ...(docIds && docIds.length ? { doc_ids: docIds } : {}),
      }),
      signal,
    })

    if (!res.ok || !res.body) {
      handlers.onError(await parseError(res))
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        const parsed = parseSseBlock(part)
        if (!parsed) continue
        try {
          const payload = JSON.parse(parsed.data)
          if (parsed.event === 'meta') handlers.onMeta(payload as StreamMetaPayload)
          else if (parsed.event === 'token') handlers.onToken((payload as { delta: string }).delta)
          else if (parsed.event === 'done') handlers.onDone(payload as StreamDonePayload)
          else if (parsed.event === 'error') {
            handlers.onError((payload as { message: string }).message)
            return
          }
        } catch {
          handlers.onError('Phản hồi không hợp lệ.')
          return
        }
      }
    }
  },
}
