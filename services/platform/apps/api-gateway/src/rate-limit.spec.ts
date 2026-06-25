import type { Response } from 'express'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '../../../src/common/redis/redis.service'
import { type GatewayRequest } from './gateway-auth'
import {
  createRateLimitMiddleware,
  resolveRateLimitPolicy,
} from './rate-limit'

describe('rate-limit', () => {
  it('uses IP-scoped buckets for anonymous requests', () => {
    const config = mockConfig({
      RATE_LIMIT_ANON: 10,
      RATE_LIMIT_WINDOW: 60,
    })

    const policy = resolveRateLimitPolicy(
      {
        ip: '203.0.113.10',
        headers: {},
      } as GatewayRequest,
      {
        userId: 'anonymous',
        username: 'anonymous',
        roles: ['Anonymous'],
        normalizedRoles: ['ANONYMOUS'],
        department: null,
        maxSecurityLevel: 1,
        scopeMaHv: null,
        scopeMaGv: null,
      },
      config,
    )

    expect(policy).toEqual({
      key: 'rate:anonymous:203.0.113.10',
      limit: 10,
      policy: 'ANONYMOUS',
      window: 60,
    })
  })

  it('applies the configured role limit for admin-like users', async () => {
    const redis = {
      increment: jest.fn().mockResolvedValue(61),
      ttl: jest.fn(),
    } as unknown as RedisService
    const config = mockConfig({
      RATE_LIMIT_AUTH: 60,
      RATE_LIMIT_ROLE_ADMIN: 180,
      RATE_LIMIT_WINDOW: 60,
    })
    const middleware = createRateLimitMiddleware(redis, config)
    const req = {
      ip: '127.0.0.1',
      headers: {},
      gatewayUser: {
        userId: 'u-admin',
        username: 'admin',
        roles: ['Admin'],
        normalizedRoles: ['ADMIN'],
        department: 'BGD',
        maxSecurityLevel: 4,
        scopeMaHv: null,
        scopeMaGv: null,
      },
    } as GatewayRequest
    const res = mockResponse()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(redis.increment).toHaveBeenCalledWith('rate:admin:u-admin', 60)
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '180')
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Policy', 'ADMIN')
    expect(res.status).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('uses the highest-priority matching role for multi-role users', () => {
    const config = mockConfig({
      RATE_LIMIT_AUTH: 60,
      RATE_LIMIT_ROLE_GIANG_VIEN: 90,
      RATE_LIMIT_ROLE_HOC_VIEN: 45,
    })

    const policy = resolveRateLimitPolicy(
      {
        ip: '127.0.0.1',
        headers: {},
      } as GatewayRequest,
      {
        userId: 'u-lecturer',
        username: 'gv001',
        roles: ['Hoc Vien', 'Giang Vien'],
        normalizedRoles: ['HOC_VIEN', 'GIANG_VIEN'],
        department: 'CNTT',
        maxSecurityLevel: 2,
        scopeMaHv: null,
        scopeMaGv: 'GV001',
      },
      config,
    )

    expect(policy.policy).toBe('GIANG_VIEN')
    expect(policy.limit).toBe(90)
    expect(policy.key).toBe('rate:giang_vien:u-lecturer')
  })

  it('returns 429 with retry-after when the bucket is exhausted', async () => {
    const redis = {
      increment: jest.fn().mockResolvedValue(3),
      ttl: jest.fn().mockResolvedValue(42),
    } as unknown as RedisService
    const config = mockConfig({
      RATE_LIMIT_ANON: 2,
      RATE_LIMIT_WINDOW: 60,
    })
    const middleware = createRateLimitMiddleware(redis, config)
    const req = {
      ip: '198.51.100.77',
      headers: {},
      gatewayUser: {
        userId: 'anonymous',
        username: 'anonymous',
        roles: ['Anonymous'],
        normalizedRoles: ['ANONYMOUS'],
        department: null,
        maxSecurityLevel: 1,
        scopeMaHv: null,
        scopeMaGv: null,
      },
    } as GatewayRequest
    const res = mockResponse()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '42')
    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        retryAfter: 42,
        limit: 2,
        policy: 'ANONYMOUS',
      }),
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('fails open when Redis is unavailable', async () => {
    const redis = {
      increment: jest.fn().mockRejectedValue(new Error('redis down')),
      ttl: jest.fn(),
    } as unknown as RedisService
    const config = mockConfig({
      RATE_LIMIT_AUTH: 60,
    })
    const middleware = createRateLimitMiddleware(redis, config)
    const req = {
      ip: '127.0.0.1',
      headers: {},
      gatewayUser: {
        userId: 'u1',
        username: 'tester',
        roles: ['HOC_VIEN'],
        normalizedRoles: ['HOC_VIEN'],
        department: null,
        maxSecurityLevel: 1,
        scopeMaHv: '676156',
        scopeMaGv: null,
      },
    } as GatewayRequest
    const res = mockResponse()
    const next = jest.fn()
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    await middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})

function mockConfig(values: Record<string, string | number>): ConfigService {
  return {
    get: jest.fn((key: string, fallback?: unknown) =>
      key in values ? values[key] : fallback,
    ),
  } as unknown as ConfigService
}

function mockResponse(): Response {
  const res = {} as Response
  res.setHeader = jest.fn()
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
