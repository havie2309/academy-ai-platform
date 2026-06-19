import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { ChatCitationDto } from '../chat/chat.citations'
import { resolveCitations } from '../chat/chat.citations'

export interface RagUserContext {
  userId: string
  username: string
  roles: string[]
  department: string | null
  maxSecurityLevel: number
  scopeMaHv?: string | null
  scopeMaGv?: string | null
}

export interface RagMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface RagChatResult {
  answer: string
  citations: ChatCitationDto[]
  route?: string
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name)
  private readonly ragUrl: string
  private readonly enabled: boolean

  constructor(private readonly config: ConfigService) {
    this.ragUrl = (
      this.config.get<string>('RAG_ENGINE_URL') ?? 'http://localhost:8000'
    ).replace(/\/+$/, '')
    this.enabled =
      this.config.get<string>('RAG_ENABLED', 'true').toLowerCase() !== 'false'
  }

  get isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Full RAG turn handled by rag-engine: retrieve -> grounded prompt -> LLM.
   * Throws on failure so the caller can fall back to the local LLM path.
   */
  async chat(
    query: string,
    messages: RagMessage[],
    user: RagUserContext,
  ): Promise<RagChatResult> {
    if (!this.enabled) throw new Error('RAG disabled')

    const res = await fetch(`${this.ragUrl}/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        messages,
        user: {
          userId: user.userId,
          username: user.username,
          roles: user.roles,
          department: user.department,
          maxSecurityLevel: user.maxSecurityLevel,
          scopeMaHv: user.scopeMaHv ?? null,
          scopeMaGv: user.scopeMaGv ?? null,
        },
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`rag-engine /v1/chat ${res.status}: ${body.slice(0, 200)}`)
    }
    const data = (await res.json()) as {
      answer?: string
      citations?: ChatCitationDto[]
      route?: string
    }
    if (!data.answer?.trim()) throw new Error('rag-engine trả về đáp án rỗng.')
    return {
      answer: data.answer,
      citations: data.citations ?? [],
      route: data.route ?? 'rag',
    }
  }

  /**
   * Streaming RAG turn: rag-engine emits SSE (meta -> token -> done). Citations
   * arrive in `onMeta` (before tokens); each token delta goes to `onToken`.
   * Throws before any callback fires if the engine is unreachable, so a caller
   * that has not yet streamed anything can fall back cleanly.
   */
  async chatStream(
    query: string,
    messages: RagMessage[],
    user: RagUserContext,
    onMeta: (citations: ChatCitationDto[], metaRoute?: string) => void,
    onToken: (delta: string) => void,
  ): Promise<RagChatResult> {
    if (!this.enabled) throw new Error('RAG disabled')

    const res = await fetch(`${this.ragUrl}/v1/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        messages,
        user: {
          userId: user.userId,
          username: user.username,
          roles: user.roles,
          department: user.department,
          maxSecurityLevel: user.maxSecurityLevel,
          scopeMaHv: user.scopeMaHv ?? null,
          scopeMaGv: user.scopeMaGv ?? null,
        },
      }),
    })
    if (!res.ok || !res.body) {
      const body = res.body ? await res.text() : ''
      throw new Error(
        `rag-engine /v1/chat/stream ${res.status}: ${body.slice(0, 200)}`,
      )
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let citations: ChatCitationDto[] = []
    let answer = ''
    let route = 'rag'

    const handleEvent = (block: string) => {
      let event = 'message'
      const dataLines: string[] = []
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
      }
      if (dataLines.length === 0) return
      let payload: Record<string, unknown>
      try {
        payload = JSON.parse(dataLines.join('\n'))
      } catch {
        return
      }
      if (event === 'meta') {
        citations = (payload.citations as ChatCitationDto[]) ?? []
        if (typeof payload.route === 'string') route = payload.route
        onMeta(citations, route)
      } else if (event === 'token') {
        const delta = payload.delta as string
        if (delta) {
          answer += delta
          onToken(delta)
        }
      } else if (event === 'done') {
        if (typeof payload.answer === 'string') answer = payload.answer
        if (typeof payload.route === 'string') route = payload.route
      } else if (event === 'error') {
        throw new Error((payload.message as string) ?? 'rag-engine stream error')
      }
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let sep: number
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        if (block.trim()) handleEvent(block)
      }
    }
    if (buffer.trim()) handleEvent(buffer)

    if (!answer.trim()) throw new Error('rag-engine stream trả về rỗng.')
    return { answer, citations, route }
  }

  /**
   * Retrieval-only path (citations). Used as a fallback by the chat service when
   * the RAG engine answer endpoint is unavailable.
   */
  async retrieveCitations(
    query: string,
    user: RagUserContext,
  ): Promise<ChatCitationDto[]> {
    if (!this.enabled) {
      return resolveCitations(query)
    }

    try {
      const res = await fetch(`${this.ragUrl}/v1/retrieve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          user: {
            userId: user.userId,
            username: user.username,
            roles: user.roles,
            department: user.department,
            maxSecurityLevel: user.maxSecurityLevel,
            scopeMaHv: user.scopeMaHv ?? null,
            scopeMaGv: user.scopeMaGv ?? null,
          },
        }),
      })

      if (!res.ok) {
        this.logger.warn(`RAG engine ${res.status} — fallback stub`)
        return resolveCitations(query)
      }

      const data = (await res.json()) as {
        citations?: ChatCitationDto[]
      }
      const citations = data.citations ?? []
      if (citations.length === 0) {
        return []
      }
      return citations.map((c) => ({
        doc_id: c.doc_id,
        chunk_id: c.chunk_id,
        title: c.title,
        snippet: c.snippet,
        source: c.source,
        ...(c.page != null ? { page: c.page } : {}),
        ...(c.section_path ? { section_path: c.section_path } : {}),
        ...(c.text ? { text: c.text } : {}),
      }))
    } catch (err) {
      this.logger.warn(
        `RAG engine unreachable — fallback stub: ${err instanceof Error ? err.message : err}`,
      )
      return resolveCitations(query)
    }
  }
}
