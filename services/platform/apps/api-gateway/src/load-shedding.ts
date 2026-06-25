import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../../src/common/redis/redis.service';
import { ConfigService } from '@nestjs/config';

function readNumberConfig(
  config: ConfigService,
  key: string,
  fallback: number,
): number {
  const value = config.get<string | number | undefined>(key);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

export function createLoadSheddingMiddleware(
  redis: RedisService,
  config: ConfigService,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const maxConcurrent = readNumberConfig(
      config,
      'LOAD_SHEDDING_MAX_CONCURRENT',
      100,
    );
    const retryAfter = readNumberConfig(config, 'LOAD_SHEDDING_RETRY_AFTER', 1);
    const key = 'global:concurrent';

    try {
      // Increment active request count
      const count = await redis.increment(key, 10); // TTL to auto-clean if stuck
      if (count > maxConcurrent) {
        await redis.decrement(key).catch(() => {});
        // Too many concurrent requests - reject.
        res.setHeader('Retry-After', String(retryAfter));
        res.status(503).json({
          message: 'He thong dang qua tai. Vui long thu lai sau.',
          retryAfter,
        });
        return;
      }

      // Allow request, then decrement on finish/close to avoid leaked counters.
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        void redis.decrement(key).catch(() => {});
      };

      res.once('finish', release);
      res.once('close', release);
      next();
    } catch (error) {
      // If Redis fails, allow request (fail-open)
      next();
    }
  };
}
