import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../../src/common/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { GatewayRequest } from './gateway-auth';

export function createRateLimitMiddleware(
  redis: RedisService,
  config: ConfigService,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const gatewayReq = req as GatewayRequest;
    const user = gatewayReq.gatewayUser;

    // Identifier: userId for authenticated, IP for anonymous
    const identifier = user?.userId || req.ip || 'unknown';
    const isAuthenticated = !!user;

    // Configurable limits
    const limit = isAuthenticated
      ? config.get<number>('RATE_LIMIT_AUTH', 60)   // 60 req/min for logged-in users
      : config.get<number>('RATE_LIMIT_ANON', 10);  // 10 req/min for anonymous
    const window = config.get<number>('RATE_LIMIT_WINDOW', 60); // seconds

    const key = `rate:${identifier}`;

    try {
      const count = await redis.increment(key, window);
      if (count > limit) {
        res.status(429).json({
          message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
          retryAfter: window,
        });
        return;
      }
    } catch (error) {
      // Redis error – allow the request but log the issue
      console.error('Rate limit error:', error);
    }

    next();
  };
}