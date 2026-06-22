import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private config: ConfigService) {
    this.client = new Redis({
      host: this.config.get('REDIS_HOST', 'localhost'),
      port: this.config.get('REDIS_PORT', 6379),
      password: this.config.get('REDIS_PASSWORD', ''),
      db: this.config.get('REDIS_DB', 0),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis error:', err);
    });
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

  async incrementFailedAttempts(userId: string, ttl: number = 900): Promise<number> {
      const key = `login:failed:${userId}`;
      const count = await this.client.incr(key);
      if (count === 1) {
          await this.client.expire(key, ttl);
      }
      return count;
  }

  async getFailedAttempts(userId: string): Promise<number> {
      const key = `login:failed:${userId}`;
      const value = await this.client.get(key);
      return value ? parseInt(value, 10) : 0;
  }

  async isAccountLocked(userId: string): Promise<boolean> {
      const key = `login:locked:${userId}`;
      return (await this.client.exists(key)) === 1;
  }

  async lockAccount(userId: string, duration: number = 900): Promise<void> {
      const key = `login:locked:${userId}`;
      await this.client.set(key, 'locked', 'EX', duration);
  }

  async resetFailedAttempts(userId: string): Promise<void> {
      await this.client.del(`login:failed:${userId}`);
      await this.client.del(`login:locked:${userId}`);
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