import type { Response } from 'express'
import { ConfigService } from '@nestjs/config'
import type { GatewayRequest } from './gateway-auth'
import { createNetworkPolicyMiddleware } from './network-policy'

describe('network-policy', () => {
  it('skips unrestricted paths even when restrictions are configured', async () => {
    const middleware = createNetworkPolicyMiddleware(
      mockConfig({
        NETWORK_RESTRICTED_PATHS: '/api/etl',
        NETWORK_ALLOWED_COUNTRIES: 'VN',
      }),
    )
    const req = {
      method: 'GET',
      path: '/api/chat',
      originalUrl: '/api/chat',
      url: '/api/chat',
      ip: '198.51.100.7',
      headers: {},
    } as GatewayRequest
    const res = mockResponse()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).not.toHaveBeenCalled()
  })

  it('denies restricted paths when the client country is not in the allowlist', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const middleware = createNetworkPolicyMiddleware(
      mockConfig({
        NETWORK_RESTRICTED_PATHS: '/api/etl',
        NETWORK_ALLOWED_COUNTRIES: 'VN',
      }),
    )
    const req = {
      method: 'GET',
      path: '/api/etl/overview',
      originalUrl: '/api/etl/overview',
      url: '/api/etl/overview',
      ip: '198.51.100.7',
      headers: {
        'x-geo-country': 'US',
      },
    } as GatewayRequest
    const res = mockResponse()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'country_not_allowed' }),
    )
    expect(next).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('fails closed when country allowlist is configured but no trusted country header is present', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const middleware = createNetworkPolicyMiddleware(
      mockConfig({
        NETWORK_RESTRICTED_PATHS: '/api/etl',
        NETWORK_ALLOWED_COUNTRIES: 'VN',
      }),
    )
    const req = {
      method: 'GET',
      path: '/api/etl/overview',
      originalUrl: '/api/etl/overview',
      url: '/api/etl/overview',
      ip: '203.0.113.10',
      headers: {},
    } as GatewayRequest
    const res = mockResponse()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'country_unavailable' }),
    )
    expect(next).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('allows restricted paths when the trusted country header is VN', async () => {
    const middleware = createNetworkPolicyMiddleware(
      mockConfig({
        NETWORK_RESTRICTED_PATHS: '/api/etl',
        NETWORK_ALLOWED_COUNTRIES: 'VN',
      }),
    )
    const req = {
      method: 'GET',
      path: '/api/etl/overview',
      originalUrl: '/api/etl/overview',
      url: '/api/etl/overview',
      ip: '203.0.113.10',
      headers: {
        'x-geo-country': 'vn',
      },
    } as GatewayRequest
    const res = mockResponse()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).not.toHaveBeenCalled()
  })

  it('denies restricted paths when the client country is blocked', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const middleware = createNetworkPolicyMiddleware(
      mockConfig({
        NETWORK_RESTRICTED_PATHS: '/api/etl',
        NETWORK_COUNTRY_HEADER: 'x-geo-country',
        NETWORK_BLOCKED_COUNTRIES: 'CN,RU',
      }),
    )
    const req = {
      method: 'GET',
      path: '/api/etl/overview',
      originalUrl: '/api/etl/overview',
      url: '/api/etl/overview',
      ip: '203.0.113.10',
      headers: {
        'x-geo-country': 'cn',
      },
    } as GatewayRequest
    const res = mockResponse()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'country_blocked' }),
    )
    expect(next).not.toHaveBeenCalled()
    warnSpy.mockRestore()
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
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
