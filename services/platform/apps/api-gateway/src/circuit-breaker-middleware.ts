import { Request, Response, NextFunction } from 'express';
import { CircuitBreaker } from './circuit-breaker';

export function createCircuitBreakerMiddleware(
  circuitBreaker: CircuitBreaker,
  serviceName: string,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const allowed = await circuitBreaker.allowRequest(serviceName);
      if (!allowed) {
        res.status(503).json({
          message: `Dịch vụ ${serviceName} tạm thời không khả dụng. Vui lòng thử lại sau.`,
        });
        return;
      }
      // Record success/failure after proxy response – can't easily do here,
      // we'll do it in the proxy's `onProxyReq` and `onProxyRes` hooks.
      next();
    } catch (error) {
      next();
    }
  };
}