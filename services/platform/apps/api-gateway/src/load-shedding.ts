import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../../src/common/redis/redis.service';
import { ConfigService } from '@nestjs/config';

export function createLoadSheddingMiddleware(
  redis: RedisService,
  config: ConfigService,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const maxConcurrent = config.get<number>('LOAD_SHEDDING_MAX_CONCURRENT', 100);
    const key = 'global:concurrent';

    try {
      // Increment active request count
      const count = await redis.increment(key, 10); // TTL to auto-clean if stuck
      if (count > maxConcurrent) {
        // Too many concurrent requests – reject
        res.status(503).json({
          message: 'Hệ thống đang quá tải. Vui lòng thử lại sau.',
        });
        return;
      }

      // Allow request, then decrement on finish
      res.on('finish', () => {
        redis.decrement(key).catch(() => {});
      });
      next();
    } catch (error) {
      // If Redis fails, allow request (fail-open)
      next();
    }
  };
}