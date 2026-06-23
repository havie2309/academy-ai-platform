import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private config: ConfigService) {
    this.client = new Redis({
      host: this.config.get('REDIS_HOST', '127.0.0.1'),
      port: Number(this.config.get('REDIS_PORT', 6379)),
      password: this.config.get('REDIS_PASSWORD', '') || undefined,
      db: Number(this.config.get('REDIS_DB', 0)),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (times > 5) return null
        return Math.min(times * 200, 2000)
      },
    })

    void this.client.connect().catch((err) => {
      this.logger.warn(`Redis unavailable at startup: ${err.message}`)
    })

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.client.on('error', (err) => {
      this.logger.warn(`Redis error: ${err.message}`)
    })
  }

  // ============================================================
  // String operations (for simple cache)
  // ============================================================

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.set(key, value, 'EX', ttl);
    } else {
      await this.client.set(key, value);
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async increment(key: string, ttl?: number): Promise<number> {
    const count = await this.client.incr(key);
    if (ttl && count === 1) {
      await this.client.expire(key, ttl);
    }
    return count;
  }

  async expire(key: string, ttl: number): Promise<void> {
    await this.client.expire(key, ttl);
  }

  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  async decrement(key: string): Promise<number> {
    const val = await this.client.decr(key);
    if (val <= 0) {
      await this.client.del(key);
    }
    return val;
  }

  /**
   * Get current count for a key.
   */
  async getCount(key: string): Promise<number> {
    const val = await this.client.get(key);
    return val ? parseInt(val, 10) : 0;
  }

  /**
   * Store a value with TTL.
   */
  async setex(key: string, value: string, ttl: number): Promise<void> {
    await this.client.setex(key, ttl, value);
  }

  /**
   * Get value and TTL in one call.
   */
  async getWithTTL(key: string): Promise<{ value: string | null; ttl: number }> {
    const results = await this.client.multi().get(key).ttl(key).exec();
    if (!results) {
      return { value: null, ttl: -2 };
    }
    // results is [ [Error | null, string | null], [Error | null, number] ]
    const value = results[0]?.[1] as string | null;
    const ttl = results[1]?.[1] as number;
    return { value, ttl };
  }

  /**
   * Delete a key.
   */
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  // ============================================================
  // JSON operations (for complex objects)
  // ============================================================

  async getJson<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async setJson<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttl);
  }

  // ============================================================
  // Hash operations (for grouped data)
  // ============================================================

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hgetAll(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  // ============================================================
  // Utility
  // ============================================================

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async flushAll(): Promise<void> {
    await this.client.flushall();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}