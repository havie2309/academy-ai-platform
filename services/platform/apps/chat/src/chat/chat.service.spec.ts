jest.mock('uuid', () => ({
  v4: () => 'uuid-test',
}))

jest.mock(
  '../../../../src/common/redis/redis.service',
  () => ({
    RedisService: class RedisService {},
  }),
  { virtual: true },
)

import { ChatService } from './chat.service'

describe('ChatService', () => {
  it('uses cached session context before falling back to Mongo history', async () => {
    const config = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'CHAT_SESSION_CONTEXT_TTL') return 1800
        return defaultValue
      }),
    }
    const rag = {
      chat: jest.fn().mockResolvedValue({
        answer: 'Hoc vien duoc du thi khi dat dieu kien chuyen can.',
        citations: [],
        route: 'rag',
      }),
    }
    const cache = {
      getSessionContext: jest.fn().mockResolvedValue({
        sessionId: 'sess-1',
        userId: 'u-admin',
        messages: [
          { role: 'user', content: 'Dieu kien du thi la gi?' },
          { role: 'assistant', content: 'Can dat chuyen can toi thieu.' },
        ],
        lastRoute: 'rag',
        updatedAt: '2026-06-19T08:00:00.000Z',
      }),
      setSessionContext: jest.fn().mockResolvedValue(undefined),
      clearSession: jest.fn().mockResolvedValue(undefined),
    }

    const service = new ChatService(config as any, rag as any, cache as any)
    const session = {
      sessionId: 'sess-1',
      userId: 'u-admin',
      title: 'Hoi dap hoc tap',
      scope: { domain: 'general' },
      createdAt: new Date('2026-06-19T07:30:00.000Z'),
      updatedAt: new Date('2026-06-19T08:00:00.000Z'),
    }

    const inserted: Array<Record<string, unknown>> = []
    const find = jest.fn()
    ;(service as any).sessions = {
      findOne: jest.fn().mockResolvedValue(session),
      updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
    }
    ;(service as any).messages = {
      insertOne: jest.fn().mockImplementation(async (doc) => {
        inserted.push(doc)
      }),
      find,
    }

    const result = await service.sendMessage(
      'u-admin',
      'sess-1',
      'Can nhung gi de du thi hoc ky?',
      {
        userId: 'u-admin',
        username: 'admin',
        roles: ['ADMIN'],
        department: 'P2',
        maxSecurityLevel: 4,
      },
    )

    expect(find).not.toHaveBeenCalled()
    expect(rag.chat).toHaveBeenCalledWith(
      'Can nhung gi de du thi hoc ky?',
      [
        { role: 'user', content: 'Dieu kien du thi la gi?' },
        { role: 'assistant', content: 'Can dat chuyen can toi thieu.' },
        { role: 'user', content: 'Can nhung gi de du thi hoc ky?' },
      ],
      expect.objectContaining({ userId: 'u-admin' }),
      'sess-1',
    )
    expect(cache.setSessionContext).toHaveBeenLastCalledWith(
      'sess-1',
      expect.objectContaining({
        sessionId: 'sess-1',
        userId: 'u-admin',
        lastRoute: 'rag',
        messages: [
          { role: 'user', content: 'Dieu kien du thi la gi?' },
          { role: 'assistant', content: 'Can dat chuyen can toi thieu.' },
          { role: 'user', content: 'Can nhung gi de du thi hoc ky?' },
          {
            role: 'assistant',
            content: 'Hoc vien duoc du thi khi dat dieu kien chuyen can.',
          },
        ],
      }),
      1800,
    )
    expect(inserted).toHaveLength(2)
    expect(result.route).toBe('rag')
  })
})
