import { EventEmitter } from 'node:events'
import type { Response } from 'express'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '../../../src/common/redis/redis.service'
import { createLoadSheddingMiddleware } from './load-shedding'

describe('load-shedding', () => {
  it('returns 503 and immediately releases the counter when saturated', async () => {
    const redis = {
      increment: jest.fn().mockResolvedValue(101),
      decrement: jest.fn().mockResolvedValue(100),
    } as unknown as RedisService
    const config = mockConfig({
      LOAD_SHEDDING_MAX_CONCURRENT: 100,
      LOAD_SHEDDING_RETRY_AFTER: 2,
    })
    const middleware = createLoadSheddingMiddleware(redis, config)
    const res = mockResponse()
    const next = jest.fn()

    await middleware({} as never, res, next)

    expect(redis.decrement).toHaveBeenCalledWith('global:concurrent')
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '2')
    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ retryAfter: 2 }),
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('releases the counter only once when the response closes and finishes', async () => {
    const redis = {
      increment: jest.fn().mockResolvedValue(10),
      decrement: jest.fn().mockResolvedValue(9),
    } as unknown as RedisService
    const config = mockConfig({
      LOAD_SHEDDING_MAX_CONCURRENT: 100,
    })
    const middleware = createLoadSheddingMiddleware(redis, config)
    const res = mockResponse()
    const next = jest.fn()

    await middleware({} as never, res, next)
    res.emit('close')
    res.emit('finish')

    expect(next).toHaveBeenCalledTimes(1)
    expect(redis.decrement).toHaveBeenCalledTimes(1)
    expect(redis.decrement).toHaveBeenCalledWith('global:concurrent')
  })

  it('fails open when Redis cannot track concurrency', async () => {
    const redis = {
      increment: jest.fn().mockRejectedValue(new Error('redis down')),
      decrement: jest.fn(),
    } as unknown as RedisService
    const config = mockConfig({
      LOAD_SHEDDING_MAX_CONCURRENT: 100,
    })
    const middleware = createLoadSheddingMiddleware(redis, config)
    const res = mockResponse()
    const next = jest.fn()

    await middleware({} as never, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).not.toHaveBeenCalled()
    expect(redis.decrement).not.toHaveBeenCalled()
  })
})

function mockConfig(values: Record<string, string | number>): ConfigService {
  return {
    get: jest.fn((key: string, fallback?: unknown) =>
      key in values ? values[key] : fallback,
    ),
  } as unknown as ConfigService
}

function mockResponse(): Response & EventEmitter {
  const res = new EventEmitter() as Response & EventEmitter
  res.setHeader = jest.fn()
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
