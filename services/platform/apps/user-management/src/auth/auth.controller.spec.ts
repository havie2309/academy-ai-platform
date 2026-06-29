import { UnauthorizedException } from '@nestjs/common'
import type { Request, Response } from 'express'
import { AuthController } from './auth.controller'
import { REFRESH_COOKIE_NAME } from './auth.cookies'
import { AuthService } from './auth.service'

describe('AuthController', () => {
  let auth: {
    login: jest.Mock
    refresh: jest.Mock
    logout: jest.Mock
  }
  let controller: AuthController

  beforeEach(() => {
    auth = {
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
    }
    controller = new AuthController(auth as unknown as AuthService)
  })

  it('returns health payload', () => {
    expect(controller.health()).toEqual({
      status: 'ok',
      service: 'user-management',
    })
  })

  it('clears the refresh cookie when no refresh token is present', async () => {
    const req = {
      headers: {},
      ip: '127.0.0.1',
    } as Request
    const res = mockResponse()

    await expect(controller.refresh(req, res)).rejects.toBeInstanceOf(
      UnauthorizedException,
    )

    expect(auth.refresh).not.toHaveBeenCalled()
    expect(res.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      expect.objectContaining({ path: '/api/auth', httpOnly: true }),
    )
  })

  it('clears the refresh cookie when the token is invalid or replayed', async () => {
    auth.refresh.mockRejectedValue(new UnauthorizedException())
    const req = {
      headers: {
        cookie: `${REFRESH_COOKIE_NAME}=replayed-token`,
        'user-agent': 'spec-agent',
      },
      ip: '127.0.0.1',
    } as unknown as Request
    const res = mockResponse()

    await expect(controller.refresh(req, res)).rejects.toBeInstanceOf(
      UnauthorizedException,
    )

    expect(auth.refresh).toHaveBeenCalledWith(
      'replayed-token',
      '127.0.0.1',
      'spec-agent',
    )
    expect(res.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      expect.objectContaining({ path: '/api/auth', httpOnly: true }),
    )
  })

  it('rotates the refresh cookie on successful refresh', async () => {
    auth.refresh.mockResolvedValue({
      access_token: 'next-access-token',
      refresh_token: 'next-refresh-token',
      user: {
        id: 'u1',
        username: 'admin',
        roles: ['ADMIN'],
      },
    })
    const req = {
      headers: {
        cookie: `${REFRESH_COOKIE_NAME}=current-refresh-token`,
        'user-agent': 'spec-agent',
      },
      ip: '127.0.0.1',
    } as unknown as Request
    const res = mockResponse()

    const result = await controller.refresh(req, res)

    expect(auth.refresh).toHaveBeenCalledWith(
      'current-refresh-token',
      '127.0.0.1',
      'spec-agent',
    )
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'next-refresh-token',
      expect.objectContaining({ path: '/api/auth', httpOnly: true }),
    )
    expect(result).toEqual({
      access_token: 'next-access-token',
      user: {
        id: 'u1',
        username: 'admin',
        roles: ['ADMIN'],
      },
    })
  })

  it('passes the current session id to logout and clears the refresh cookie', async () => {
    auth.logout.mockResolvedValue({ message: 'ok' })
    const req = {
      headers: {
        cookie: `${REFRESH_COOKIE_NAME}=current-refresh-token`,
        'user-agent': 'spec-agent',
      },
      ip: '127.0.0.1',
      user: {
        userId: 'u1',
        sessionId: 'session-1',
      },
    } as unknown as Request & { user: { userId: string; sessionId?: string | null } }
    const res = mockResponse()

    const result = await controller.logout(req, res)

    expect(auth.logout).toHaveBeenCalledWith(
      'current-refresh-token',
      'u1',
      'session-1',
      '127.0.0.1',
      'spec-agent',
    )
    expect(res.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      expect.objectContaining({ path: '/api/auth', httpOnly: true }),
    )
    expect(result).toEqual({ message: 'ok' })
  })
})

function mockResponse(): Response {
  const res = {} as Response
  res.cookie = jest.fn().mockReturnValue(res)
  res.clearCookie = jest.fn().mockReturnValue(res)
  return res
}
