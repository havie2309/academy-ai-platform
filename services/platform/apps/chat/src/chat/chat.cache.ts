import { Injectable, Logger } from '@nestjs/common'
import { RedisService } from '../../../../src/common/redis/redis.service'

export interface CachedSessionMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface CachedSessionContext {
  sessionId: string
  userId: string
  messages: CachedSessionMessage[]
  lastRoute?: string | null
  updatedAt: string
}

@Injectable()
export class ChatCacheService {
  private readonly logger = new Logger(ChatCacheService.name)
  private readonly PREFIX = 'chat:'

  constructor(private readonly redis: RedisService) {}

  async getSessionContext(
    sessionId: string,
  ): Promise<CachedSessionContext | null> {
    const key = `${this.PREFIX}session:${sessionId}`
    return this.redis.getJson<CachedSessionContext>(key)
  }

  async setSessionContext(
    sessionId: string,
    context: CachedSessionContext,
    ttl = 3600,
  ): Promise<void> {
    const key = `${this.PREFIX}session:${sessionId}`
    await this.redis.setJson(key, context, ttl)
    this.logger.debug(
      `Session cached: ${sessionId} messages=${context.messages.length} route=${context.lastRoute ?? 'none'}`,
    )
  }

  async clearSession(sessionId: string): Promise<void> {
    const key = `${this.PREFIX}session:${sessionId}`
    await this.redis.delete(key)
  }

  async incrementRateLimit(
    userId: string,
    limit = 60,
    window = 60,
  ): Promise<number> {
    const key = `${this.PREFIX}rate:${userId}`
    const count = await this.redis.increment(key, window)

    if (count === 1) {
      await this.redis.expire(key, window)
    }

    return count
  }

  async getRateLimit(userId: string): Promise<number> {
    const key = `${this.PREFIX}rate:${userId}`
    const value = await this.redis.get(key)
    return value ? parseInt(value, 10) : 0
  }
}
