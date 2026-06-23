import { RedisService } from '../../../src/common/redis/redis.service';
import { ConfigService } from '@nestjs/config';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold: number;   // failures before opening
  timeout: number;            // seconds to stay open
  halfOpenMaxRequests: number; // max requests in half-open state
}

export class CircuitBreaker {
  private readonly prefix = 'circuit:';
  private readonly redis: RedisService;
  private readonly config: ConfigService;

  constructor(redis: RedisService, config: ConfigService) {
    this.redis = redis;
    this.config = config;
  }

  private getKey(service: string): string {
    return `${this.prefix}${service}`;
  }

  private getOptions(service: string): CircuitBreakerOptions {
    // Per-service config, fallback to defaults
    return {
      failureThreshold: this.config.get<number>(`CIRCUIT_FAILURE_THRESHOLD_${service.toUpperCase()}`, 5),
      timeout: this.config.get<number>(`CIRCUIT_TIMEOUT_${service.toUpperCase()}`, 30),
      halfOpenMaxRequests: this.config.get<number>(`CIRCUIT_HALFOPEN_MAX_${service.toUpperCase()}`, 1),
    };
  }

  async getState(service: string): Promise<CircuitState> {
    const key = this.getKey(service);
    const state = await this.redis.get(key);
    if (!state) return 'CLOSED';
    return state as CircuitState;
  }

  async recordSuccess(service: string): Promise<void> {
    const key = this.getKey(service);
    // Reset failure count and set state to CLOSED (or keep as is if HALF_OPEN)
    const state = await this.redis.get(key);
    if (state === 'HALF_OPEN') {
      // If half-open and success, close the circuit
      await this.redis.del(key);
    }
    // Also reset the failure counter
    await this.redis.del(`${key}:failures`);
  }

  async recordFailure(service: string): Promise<boolean> {
    // If already OPEN, do nothing (will be rejected)
    const state = await this.getState(service);
    if (state === 'OPEN') return false;

    // Increment failure counter
    const failKey = `${this.getKey(service)}:failures`;
    const count = await this.redis.increment(failKey, this.getOptions(service).timeout);
    const threshold = this.getOptions(service).failureThreshold;

    if (count >= threshold) {
      // Open the circuit
      const key = this.getKey(service);
      await this.redis.setex(key, 'OPEN', this.getOptions(service).timeout);
      return false; // failure recorded, but circuit opened
    }
    return true; // failure recorded, but circuit still closed
  }

  async allowRequest(service: string): Promise<boolean> {
    const state = await this.getState(service);
    if (state === 'CLOSED') return true;

    if (state === 'OPEN') {
      // Check if timeout elapsed, if so, transition to HALF_OPEN
      const key = this.getKey(service);
      const { ttl } = await this.redis.getWithTTL(key);
      if (ttl <= 0) {
        // Timeout expired, move to half-open
        await this.redis.setex(key, 'HALF_OPEN', 10); // allow a few requests
        return true;
      }
      return false;
    }

    // HALF_OPEN – allow limited requests
    const halfOpenKey = `${this.getKey(service)}:halfopen`;
    const count = await this.redis.increment(halfOpenKey, 10); // TTL 10s
    const max = this.getOptions(service).halfOpenMaxRequests;
    if (count <= max) {
      return true;
    }
    return false; // too many half-open requests
  }
}