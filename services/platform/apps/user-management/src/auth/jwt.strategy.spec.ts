import { UnauthorizedException } from '@nestjs/common'
import { JwtStrategy } from './jwt.strategy'

describe('JwtStrategy', () => {
  let config: {
    get: jest.Mock
  }
  let tokenRevocations: {
    isAccessTokenRevoked: jest.Mock
  }
  let strategy: JwtStrategy

  beforeEach(() => {
    config = {
      get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
    }
    tokenRevocations = {
      isAccessTokenRevoked: jest.fn().mockResolvedValue(false),
    }
    strategy = new JwtStrategy(
      config as never,
      tokenRevocations as never,
    )
  })

  it('maps sid onto the authenticated request user', async () => {
    const result = await strategy.validate({
      sub: 'u1',
      username: 'tester',
      roles: ['ADMIN'],
      department: 'P2',
      max_security_level: 4,
      sid: 'session-1',
      iat_ms: Date.now(),
    })

    expect(result).toEqual({
      userId: 'u1',
      username: 'tester',
      roles: ['ADMIN'],
      department: 'P2',
      maxSecurityLevel: 4,
      sessionId: 'session-1',
    })
  })

  it('rejects revoked access tokens', async () => {
    tokenRevocations.isAccessTokenRevoked.mockResolvedValue(true)

    await expect(
      strategy.validate({
        sub: 'u1',
        username: 'tester',
        roles: ['ADMIN'],
        sid: 'session-1',
        iat_ms: Date.now(),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
