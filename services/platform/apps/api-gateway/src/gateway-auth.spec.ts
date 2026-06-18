import { JwtService } from '@nestjs/jwt'
import type { Response } from 'express'
import {
  createGatewayAuthMiddleware,
  isProtectedPath,
  type GatewayRequest,
} from './gateway-auth'

describe('gateway-auth', () => {
  it('classifies public and protected paths correctly', () => {
    expect(isProtectedPath('/api/health')).toBe(false)
    expect(isProtectedPath('/api/auth/login')).toBe(false)
    expect(isProtectedPath('/api/auth/refresh')).toBe(false)
    expect(isProtectedPath('/api/auth/logout')).toBe(true)
    expect(isProtectedPath('/api/chat/sessions')).toBe(true)
    expect(isProtectedPath('/api/rag/v1/retrieve')).toBe(true)
  })

  it('accepts a valid bearer token on protected routes', () => {
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

    middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(req.gatewayUser).toEqual({
      userId: 'u1',
      username: 'tester',
      roles: ['Admin'],
      department: 'P2',
      maxSecurityLevel: 4,
    })
  })

  it('rejects missing tokens on protected routes', () => {
    const middleware = createGatewayAuthMiddleware('spec-secret')
    const req = {
      method: 'GET',
      path: '/api/chat/sessions',
      headers: {},
    } as GatewayRequest
    const res = mockResponse()
    const next = jest.fn()

    middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalled()
  })
})

function mockResponse(): Response {
  const res = {} as Response
  res.setHeader = jest.fn()
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
