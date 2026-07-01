import { JwtService } from '@nestjs/jwt'
import type { Response } from 'express'
import {
  extractFormattedBearerJwt,
  isWellFormedJwtCompactToken,
} from '../../../src/common/jwt-token-format'
import {
  attachGatewayUserHeaders,
  createGatewayAuthMiddleware,
  isProtectedPath,
  type GatewayRequest,
} from './gateway-auth'

describe('gateway-auth', () => {
  it('classifies public and protected paths correctly', () => {
    expect(isProtectedPath('/api/health')).toBe(false)
    expect(isProtectedPath('/api/auth/health')).toBe(false)
    expect(isProtectedPath('/api/auth/login')).toBe(false)
    expect(isProtectedPath('/api/auth/refresh')).toBe(false)
    expect(isProtectedPath('/api/auth/logout')).toBe(true)
    expect(isProtectedPath('/api/chat/sessions')).toBe(true)
    expect(isProtectedPath('/api/etl/overview')).toBe(true)
    expect(isProtectedPath('/api/rag/v1/retrieve')).toBe(true)
    expect(isProtectedPath('/api/admin-config/rag-policy')).toBe(true)
    expect(isProtectedPath('/api/rbac/me')).toBe(true)
    expect(isProtectedPath('/api/audit/logs')).toBe(true)
    expect(isProtectedPath('/api/etl/health')).toBe(false)
    expect(isProtectedPath('/api/admin-config/health')).toBe(false)
  })

  it('accepts a valid bearer token on protected routes', async () => {
    const secret = 'spec-secret'
    const token = new JwtService({ secret }).sign({
      sub: 'u1',
      username: 'tester',
      roles: ['Admin'],
      department: 'P2',
      max_security_level: 4,
    })
    const middleware = createGatewayAuthMiddleware(secret)

    const req = {
      method: 'GET',
      path: '/api/chat/sessions',
      headers: { authorization: `Bearer ${token}` },
    } as GatewayRequest
    const res = mockResponse()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(req.gatewayUser).toEqual({
      userId: 'u1',
      username: 'tester',
      roles: ['Admin'],
      normalizedRoles: ['ADMIN'],
      department: 'P2',
      maxSecurityLevel: 4,
      scopeMaHv: null,
      scopeMaGv: null,
      sessionId: null,
    })
  })

  it('rejects revoked bearer tokens on protected routes', async () => {
    const secret = 'spec-secret'
    const token = new JwtService({ secret }).sign({
      sub: 'u1',
      username: 'tester',
      roles: ['Admin'],
      sid: 'session-1',
      iat_ms: Date.now(),
    })
    const securityAlerts = {
      safeRecordAlert: jest.fn().mockResolvedValue(null),
    }
    const middleware = createGatewayAuthMiddleware(secret, {
      isAccessTokenRevoked: jest.fn().mockResolvedValue(true),
    }, securityAlerts as any)

    const req = {
      method: 'GET',
      path: '/api/chat/sessions',
      headers: { authorization: `Bearer ${token}` },
    } as GatewayRequest
    const res = mockResponse()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalled()
    expect(securityAlerts.safeRecordAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleCode: 'gateway.revoked_token_reuse',
        sessionId: 'session-1',
      }),
    )
  })

  it('rejects missing tokens on protected routes', async () => {
    const middleware = createGatewayAuthMiddleware('spec-secret')
    const req = {
      method: 'GET',
      path: '/api/chat/sessions',
      headers: {},
    } as GatewayRequest
    const res = mockResponse()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalled()
  })

  it('rejects malformed bearer tokens before revocation lookup', async () => {
    const revocations = {
      isAccessTokenRevoked: jest.fn().mockResolvedValue(false),
    }
    const middleware = createGatewayAuthMiddleware('spec-secret', revocations)
    const req = {
      method: 'GET',
      path: '/api/chat/sessions',
      headers: { authorization: 'Bearer definitely-not-a-jwt' },
    } as GatewayRequest
    const res = mockResponse()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(revocations.isAccessTokenRevoked).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('extracts only well-formed compact JWT bearer tokens', () => {
    const validToken = new JwtService({ secret: 'spec-secret' }).sign({
      sub: 'u1',
      username: 'tester',
      roles: ['Admin'],
    })

    expect(
      extractFormattedBearerJwt({
        headers: { authorization: `Bearer ${validToken}` },
      } as GatewayRequest),
    ).toBe(validToken)
    expect(isWellFormedJwtCompactToken(validToken)).toBe(true)
    expect(isWellFormedJwtCompactToken('not-a-jwt')).toBe(false)
    expect(isWellFormedJwtCompactToken('a.b')).toBe(false)
  })

  it('forwards normalized scope headers for downstream services', () => {
    const req = {
      gatewayUser: {
        userId: 'u1',
        username: 'tester',
        roles: ['Admin'],
        normalizedRoles: ['ADMIN'],
        department: 'P2',
        maxSecurityLevel: 4,
        scopeMaHv: '666106',
        scopeMaGv: 'GV001',
        sessionId: 'session-77',
      },
    } as GatewayRequest

    const headers = new Map<string, string>()
    attachGatewayUserHeaders(req, (name, value) => {
      headers.set(name, value)
    })

    expect(headers.get('x-gateway-user-id')).toBe('u1')
    expect(headers.get('x-gateway-normalized-roles')).toBe('ADMIN')
    expect(headers.get('x-gateway-scope-ma-hv')).toBe('666106')
    expect(headers.get('x-gateway-scope-ma-gv')).toBe('GV001')
    expect(headers.get('x-gateway-session-id')).toBe('session-77')
    expect(headers.get('x-gateway-access-scope')).toContain(
      '"scopeMaHv":"666106"',
    )
  })
})

function mockResponse(): Response {
  const res = {} as Response
  res.setHeader = jest.fn()
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
