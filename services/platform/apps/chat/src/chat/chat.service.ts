import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Response } from 'express'
import { Collection, Db, MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { type ChatCitationDto } from './chat.citations'
import { initSse, writeSseError, writeSseEvent } from './chat-sse.util'
import {
  RagService,
  type RagMessage,
  type RagUserContext,
} from '../rag/rag.service'

const SYSTEM_PROMPT = `
Bạn là trợ lý ảo của học viện, hỗ trợ cán bộ, giảng viên và học viên tra cứu thông tin đào tạo, khảo thí, nghiên cứu khoa học.

Nguyên tắc trả lời:
- Luôn trả lời bằng tiếng Việt.
- Trả lời ngắn gọn, rõ ràng, đúng trọng tâm.
- Chỉ dùng thông tin có trong tài liệu được cung cấp.
- Không bịa thông tin ngoài tài liệu.
- Nếu không tìm thấy thông tin trong tài liệu, trả lời: "Tôi không tìm thấy thông tin này trong tài liệu được cung cấp."

Định dạng câu trả lời:
- Không chèn mã tài liệu, phiên bản, ngày ban hành, metadata vào giữa câu trả lời.
- Nếu câu trả lời có nhiều ý, dùng danh sách bullet.
- Không viết phần "Ghi chú kiểm thử" cho người dùng.
- Không lặp lại nguồn nhiều lần trong từng bullet.
- Phần nguồn tham khảo phải đặt riêng ở cuối câu trả lời.

Ví dụ format tốt:
"Khi đi thi, sinh viên cần mang theo:

- Thẻ sinh viên
- Giấy tờ tùy thân

Nguồn tham khảo: DOC-HK2-2026-REG-001"

Ví dụ format xấu cần tránh:
"Giấy tờ tùy thân (tài liệu 1) [1]: Mã tài liệu: DOC-HK2-2026-REG-001; Phiên bản: 1.0; Ngày ban hành: 01/06/2026"
`

const TITLE_SYSTEM_PROMPT = `
Đặt tiêu đề ngắn cho cuộc hội thoại.
Tiêu đề phải mô tả chủ đề cuộc hội thoại, không tiết lộ đáp án chi tiết.
Chỉ trả về 3–6 từ tiếng Việt.
Không dùng dấu ngoặc.
Không giải thích.
Không lặp nguyên văn câu hỏi.
Không thêm dấu chấm cuối câu.
`

const MAX_HISTORY = 20
const MAX_TITLE_LENGTH = 48
const DEFAULT_SESSION_TITLE = 'Cuộc trò chuyện mới'

interface ChatSessionDoc {
  sessionId: string
  userId: string
  title: string
  scope: { domain: string }
  createdAt: Date
  updatedAt: Date
}

interface ChatMessageDoc {
  messageId: string
  sessionId: string
  userId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  citations?: ChatCitationDto[]
  route?: string
  createdAt: Date
}

@Injectable()
export class ChatService implements OnModuleInit {
  private readonly logger = new Logger(ChatService.name)
  private client!: MongoClient
  private db!: Db
  private sessions!: Collection<ChatSessionDoc>
  private messages!: Collection<ChatMessageDoc>

  constructor(
    private readonly config: ConfigService,
    private readonly rag: RagService,
  ) {}

  async onModuleInit() {
    const uri =
      this.config.get<string>('MONGO_URI') ??
      `mongodb://${this.config.get('MONGO_USER', 'pm2_user')}:${this.config.get('MONGO_PASSWORD', 'pm2pass')}@${this.config.get('MONGO_HOST', 'localhost')}:${this.config.get('MONGO_PORT', '27017')}/${this.config.get('MONGO_DB', 'pm2')}?authSource=admin`

    this.client = new MongoClient(uri)
    await this.client.connect()
    this.db = this.client.db(this.config.get('MONGO_DB', 'pm2'))
    this.sessions = this.db.collection('chat_sessions')
    this.messages = this.db.collection('chat_messages')
  }

  async listSessions(userId: string) {
    if (!this.sessions) {
      throw new ServiceUnavailableException('Chat database chưa sẵn sàng.')
    }
    const rows = await this.sessions
      .find({ userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray()
    return rows.map((s) => this.toSessionDto(s))
  }

  async createSession(userId: string, title?: string) {
    const now = new Date()
    const doc: ChatSessionDoc = {
      sessionId: uuidv4(),
      userId,
      title: title?.trim() || DEFAULT_SESSION_TITLE,
      scope: { domain: 'general' },
      createdAt: now,
      updatedAt: now,
    }
    await this.sessions.insertOne(doc)
    return this.toSessionDto(doc)
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.sessions.findOne({ sessionId, userId })
    if (!session) throw new NotFoundException('Không tìm thấy hội thoại.')
    return this.toSessionDto(session)
  }

  async deleteSession(userId: string, sessionId: string) {
    const result = await this.sessions.deleteOne({ sessionId, userId })
    if (result.deletedCount === 0) throw new NotFoundException('Không tìm thấy hội thoại.')
    await this.messages.deleteMany({ sessionId, userId })
    return { deleted: true }
  }

  async listMessages(userId: string, sessionId: string) {
    await this.getSession(userId, sessionId)
    const rows = await this.messages
      .find({ sessionId, userId, role: { $in: ['user', 'assistant'] } })
      .sort({ createdAt: 1 })
      .toArray()
    return rows.map((m) => this.toMessageDto(m))
  }

  async sendMessage(
    userId: string,
    sessionId: string,
    content: string,
    ragUser: RagUserContext,
  ) {
    const { session, userMsg, history, text } = await this.prepareUserMessage(
      userId,
      sessionId,
      content,
    )
    let answer: string
    let clientCitations: ChatCitationDto[]
    try {
      // Primary: rag-engine owns the full RAG turn (retrieve + grounded answer).
      const result = await this.rag.chat(
        text,
        this.toRagMessages(history),
        ragUser,
      )
      answer = result.answer
      clientCitations = result.citations
    } catch (err) {
      // Fallback: rag-engine down -> retrieve + local LLM here.
      this.logger.warn(
        `rag-engine /v1/chat lỗi — fallback LLM nội bộ: ${err instanceof Error ? err.message : err}`,
      )
      const citations = await this.rag.retrieveCitations(text, ragUser)
      answer = await this.callLlm(history, citations)
      clientCitations = this.toClientCitations(citations)
    }
    if (this.isNoInfoAnswer(answer)) {
      clientCitations = []
    }

    const assistantMsg = await this.persistAssistantMessage(
      userId,
      sessionId,
      answer,
      clientCitations,
      'rag',
    )
    const titleUpdate = await this.maybeUpdateSessionTitle(
      session,
      userId,
      sessionId,
      text,
      answer,
    )

    return {
      session: {
        ...this.toSessionDto(session),
        title: titleUpdate,
        updated_at: assistantMsg.createdAt.toISOString(),
      },
      user_message: this.toMessageDto(userMsg),
      assistant_message: this.toMessageDto(assistantMsg),
      citations: clientCitations,
      route: 'rag' as const,
    }
  }

  async streamMessage(
    userId: string,
    sessionId: string,
    content: string,
    ragUser: RagUserContext,
    res: Response,
  ): Promise<void> {
    initSse(res)

    try {
      const { session, userMsg, history, text } = await this.prepareUserMessage(
        userId,
        sessionId,
        content,
      )
      let answer = ''
      let clientCitations: ChatCitationDto[] = []
      let streamed = false
      try {
        // Primary: rag-engine streams the grounded answer (meta -> tokens).
        const result = await this.rag.chatStream(
          text,
          this.toRagMessages(history),
          ragUser,
          (citations) => {
            streamed = true
            writeSseEvent(res, 'meta', {
              user_message: this.toMessageDto(userMsg),
              citations,
              route: 'rag',
            })
          },
          (delta) => {
            streamed = true
            writeSseEvent(res, 'token', { delta })
          },
        )
        answer = result.answer
        clientCitations = result.citations
      } catch (err) {
        // If anything was already streamed to the client we cannot fall back
        // cleanly (meta/tokens already sent) — surface the error instead.
        if (streamed) throw err
        this.logger.warn(
          `rag-engine /v1/chat/stream lỗi — fallback LLM nội bộ: ${err instanceof Error ? err.message : err}`,
        )
        const citations = await this.rag.retrieveCitations(text, ragUser)
        clientCitations = this.toClientCitations(citations)
        writeSseEvent(res, 'meta', {
          user_message: this.toMessageDto(userMsg),
          citations: clientCitations,
          route: 'rag',
        })
        answer = await this.streamLlm(history, citations, (delta) => {
          writeSseEvent(res, 'token', { delta })
        })
      }
      if (this.isNoInfoAnswer(answer)) {
        clientCitations = []
      }

      const assistantMsg = await this.persistAssistantMessage(
        userId,
        sessionId,
        answer,
        clientCitations,
        'rag',
      )
      const titleUpdate = await this.maybeUpdateSessionTitle(
        session,
        userId,
        sessionId,
        text,
        answer,
      )

      writeSseEvent(res, 'done', {
        session: {
          ...this.toSessionDto(session),
          title: titleUpdate,
          updated_at: assistantMsg.createdAt.toISOString(),
        },
        assistant_message: this.toMessageDto(assistantMsg),
        citations: clientCitations,
        route: 'rag',
      })
      res.end()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Không thể gửi tin nhắn.'
      writeSseError(res, message)
    }
  }

  private async prepareUserMessage(
    userId: string,
    sessionId: string,
    content: string,
  ) {
    const text = content?.trim()
    if (!text) throw new BadRequestException('Nội dung tin nhắn không được để trống.')

    const session = await this.sessions.findOne({ sessionId, userId })
    if (!session) throw new NotFoundException('Không tìm thấy hội thoại.')

    const now = new Date()
    const userMsg: ChatMessageDoc = {
      messageId: uuidv4(),
      sessionId,
      userId,
      role: 'user',
      content: text,
      createdAt: now,
    }
    await this.messages.insertOne(userMsg)

    const history = await this.messages
      .find({ sessionId, userId, role: { $in: ['user', 'assistant'] } })
      .sort({ createdAt: 1 })
      .limit(MAX_HISTORY)
      .toArray()

    return { session, userMsg, history, text }
  }

  private async persistAssistantMessage(
    userId: string,
    sessionId: string,
    content: string,
    citations: ChatCitationDto[],
    route: string,
  ): Promise<ChatMessageDoc> {
    const assistantMsg: ChatMessageDoc = {
      messageId: uuidv4(),
      sessionId,
      userId,
      role: 'assistant',
      content,
      citations,
      route,
      createdAt: new Date(),
    }
    await this.messages.insertOne(assistantMsg)
    return assistantMsg
  }

  private async maybeUpdateSessionTitle(
    session: ChatSessionDoc,
    userId: string,
    sessionId: string,
    userText: string,
    answer: string,
  ): Promise<string> {
    const needsTitle = session.title === DEFAULT_SESSION_TITLE
    const titleUpdate = needsTitle
      ? await this.generateSessionTitle(userText, answer)
      : session.title

    await this.sessions.updateOne(
      { sessionId, userId },
      { $set: { title: titleUpdate, updatedAt: new Date() } },
    )
    return titleUpdate
  }

  private async generateSessionTitle(
    userText: string,
    assistantText: string,
  ): Promise<string> {
    try {
      return await this.callLlmForTitle(userText, assistantText)
    } catch {
      return this.fallbackTitle(userText)
    }
  }

  private fallbackTitle(userText: string): string {
    const cleaned = userText.replace(/\s+/g, ' ').trim()
    if (cleaned.length <= MAX_TITLE_LENGTH) return cleaned
    const slice = cleaned.slice(0, MAX_TITLE_LENGTH)
    const lastSpace = slice.lastIndexOf(' ')
    const cut = lastSpace > 16 ? slice.slice(0, lastSpace) : slice
    return `${cut}…`
  }

  private getOpenAiApiKey(): string {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim()
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình OPENAI_API_KEY trong services/platform/.env (chỉ server, không đặt VITE_ trên frontend).',
      )
    }
    return apiKey
  }

  private getOpenAiModel(): string {
    return this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini')
  }

  /**
   * Chọn backend LLM theo LLM_PROVIDER:
   * - 'openai': gọi OpenAI cloud (cần OPENAI_API_KEY).
   * - 'ollama' (mặc định): gọi endpoint OpenAI-compatible của Ollama tại LLM_BASE_URL.
   * Nếu không set LLM_PROVIDER: dùng 'ollama' khi có LLM_BASE_URL, ngược lại 'openai'.
   */
  private getLlmConfig(): {
    provider: 'openai' | 'ollama'
    url: string
    model: string
    headers: Record<string, string>
  } {
    const explicit = this.config.get<string>('LLM_PROVIDER')?.trim().toLowerCase()
    const baseUrl = this.config.get<string>('LLM_BASE_URL')?.trim()
    const provider: 'openai' | 'ollama' =
      explicit === 'openai'
        ? 'openai'
        : explicit === 'ollama'
          ? 'ollama'
          : baseUrl
            ? 'ollama'
            : 'openai'

    if (provider === 'openai') {
      return {
        provider,
        url: 'https://api.openai.com/v1/chat/completions',
        model: this.getOpenAiModel(),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.getOpenAiApiKey()}`,
        },
      }
    }

    const base = (baseUrl ?? 'http://localhost:11434').replace(/\/+$/, '')
    return {
      provider,
      url: `${base}/v1/chat/completions`,
      model: this.config.get<string>('LLM_MODEL', 'qwen2.5:3b'),
      headers: { 'Content-Type': 'application/json' },
    }
  }

  private async callLlmForTitle(
    userText: string,
    assistantText: string,
  ): Promise<string> {
    const llm = this.getLlmConfig()
    const res = await fetch(llm.url, {
      method: 'POST',
      headers: llm.headers,
      body: JSON.stringify({
        model: llm.model,
        max_tokens: 24,
        temperature: 0.3,
        messages: [
          { role: 'system', content: TITLE_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Người dùng: ${userText.slice(0, 200)}\nTrợ lý: ${assistantText.slice(0, 300)}`,
          },
        ],
      }),
    })

    if (!res.ok) {
      throw new ServiceUnavailableException(`LLM title lỗi (${res.status})`)
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const raw = data.choices?.[0]?.message?.content?.trim()
    if (!raw) throw new ServiceUnavailableException('LLM title rỗng.')

    const title = raw.replace(/^["'「『]|["'」』]$/g, '').trim()
    if (!title) return this.fallbackTitle(userText)
    return title.length > MAX_TITLE_LENGTH
      ? `${title.slice(0, MAX_TITLE_LENGTH - 1)}…`
      : title
  }

  private buildOpenAiMessages(
    history: ChatMessageDoc[],
    citations: ChatCitationDto[],
  ) {
    const contextBlock =
      citations.length > 0
        ? `\n\nNgữ cảnh tham khảo (trích từ kho tài liệu):\n${citations
            .map(
              (c, i) =>
                `[${i + 1}] ${c.title} (${c.source}): ${c.text ?? c.snippet}`,
            )
            .join('\n')}\n\nTrả lời bằng markdown ngắn gọn. Khi dùng thông tin từ ngữ cảnh, ghi rõ nguồn.`
        : ''

    return [
      { role: 'system' as const, content: SYSTEM_PROMPT + contextBlock },
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ]
  }

  private async streamLlm(
    history: ChatMessageDoc[],
    citations: ChatCitationDto[],
    onDelta: (delta: string) => void,
  ): Promise<string> {
    const llm = this.getLlmConfig()
    const messages = this.buildOpenAiMessages(history, citations)

    const res = await fetch(llm.url, {
      method: 'POST',
      headers: llm.headers,
      body: JSON.stringify({ model: llm.model, messages, stream: true }),
    })

    if (!res.ok || !res.body) {
      const body = await res.text()
      throw new ServiceUnavailableException(
        `LLM API lỗi (${res.status}): ${body.slice(0, 200)}`,
      )
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') continue
        try {
          const parsed = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[]
          }
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) {
            fullContent += delta
            onDelta(delta)
          }
        } catch {
          // skip malformed chunk
        }
      }
    }

    if (!fullContent.trim()) {
      throw new ServiceUnavailableException('LLM trả về rỗng.')
    }
    return fullContent
  }

  private async callLlm(
    history: ChatMessageDoc[],
    citations: ChatCitationDto[] = [],
  ): Promise<string> {
    const llm = this.getLlmConfig()
    const messages = this.buildOpenAiMessages(history, citations)

    const res = await fetch(llm.url, {
      method: 'POST',
      headers: llm.headers,
      body: JSON.stringify({ model: llm.model, messages }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new ServiceUnavailableException(
        `LLM API lỗi (${res.status}): ${body.slice(0, 200)}`,
      )
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new ServiceUnavailableException('LLM trả về rỗng.')
    return content
  }

  /**
   * Drop the full chunk `text` (LLM grounding context) so it is never persisted
   * or sent to the client — the UI only needs title/snippet/source.
   */
  private toClientCitations(
    citations: ChatCitationDto[],
  ): ChatCitationDto[] {
    return citations.map(({ text: _text, ...rest }) => rest)
  }

  /** Map stored history docs to the role/content shape rag-engine expects. */
  private toRagMessages(history: ChatMessageDoc[]): RagMessage[] {
    return history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))
  }

  private isNoInfoAnswer(answer: string): boolean {
    const text = answer.trim().toLowerCase()
    return (
      text.includes('không tìm thấy thông tin') ||
      text.includes('khong tim thay thong tin') ||
      text.includes('không có thông tin')
    )
  }

  private toSessionDto(s: ChatSessionDoc) {
    return {
      id: s.sessionId,
      title: s.title,
      created_at: s.createdAt.toISOString(),
      updated_at: s.updatedAt.toISOString(),
    }
  }

  private toMessageDto(m: ChatMessageDoc) {
    return {
      id: m.messageId,
      session_id: m.sessionId,
      role: m.role,
      content: m.content,
      created_at: m.createdAt.toISOString(),
      ...(m.citations?.length ? { citations: m.citations } : {}),
      ...(m.route ? { route: m.route } : {}),
    }
  }
}
