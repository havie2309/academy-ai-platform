import { UnauthorizedException } from '@nestjs/common'
import * as argon2 from 'argon2'
import { AuthService } from './auth.service'

describe('AuthService', () => {
  let passwordHash: string

  let users: {
    findByUsername: jest.Mock
    saveSession: jest.Mock
    updateLastLogin: jest.Mock
    logLogin: jest.Mock
    revokeSessionById: jest.Mock
    revokeSessionByRefreshHash: jest.Mock
  }
  let jwt: {
    sign: jest.Mock
  }
  let config: {
    get: jest.Mock
  }
  let redis: {
    isAccountLocked: jest.Mock
    ttl: jest.Mock
    incrementFailedAttempts: jest.Mock
    lockAccount: jest.Mock
    resetFailedAttempts: jest.Mock
  }
  let securityAlerts: {
    safeRecordAlert: jest.Mock
  }
  let tokenRevocations: {
    revokeAccessForSession: jest.Mock
  }
  let service: AuthService

  beforeEach(async () => {
    passwordHash = await argon2.hash('correct-password')

    users = {
      findByUsername: jest.fn(),
      saveSession: jest.fn().mockResolvedValue('session-1'),
      updateLastLogin: jest.fn().mockResolvedValue(undefined),
      logLogin: jest.fn().mockResolvedValue(undefined),
      revokeSessionById: jest.fn().mockResolvedValue({
        session_id: 'session-1',
        user_id: 'u-p7',
      }),
      revokeSessionByRefreshHash: jest.fn().mockResolvedValue(null),
    }
    jwt = {
      sign: jest.fn().mockReturnValue('access-token'),
    }
    config = {
      get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
    }
    redis = {
      isAccountLocked: jest.fn(),
      ttl: jest.fn(),
      incrementFailedAttempts: jest.fn(),
      lockAccount: jest.fn(),
      resetFailedAttempts: jest.fn().mockResolvedValue(undefined),
    }
    securityAlerts = {
      safeRecordAlert: jest.fn().mockResolvedValue(undefined),
    }
    tokenRevocations = {
      revokeAccessForSession: jest.fn().mockResolvedValue(undefined),
    }

    service = new AuthService(
      users as never,
      jwt as never,
      config as never,
      redis as never,
      securityAlerts as never,
      tokenRevocations as never,
    )
  })

  it('does not apply login temporary lock to admin-like P7 accounts', async () => {
    users.findByUsername.mockResolvedValue({
      user_id: 'u-p7',
      username: 'p7-admin',
      fullname: 'P7 Admin',
      department: 'P7',
      max_security_level: 2,
      roles: ['P7'],
      password_hash: passwordHash,
      hash_algorithm: 'argon2id',
    })
    redis.isAccountLocked.mockResolvedValue(true)

    const result = await service.login(
      'p7-admin',
      'correct-password',
      '127.0.0.1',
      'jest-agent',
    )

    expect(redis.isAccountLocked).not.toHaveBeenCalled()
    expect(redis.incrementFailedAttempts).not.toHaveBeenCalled()
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'u-p7',
        sid: 'session-1',
        iat_ms: expect.any(Number),
      }),
      expect.objectContaining({ expiresIn: '15m' }),
    )
    expect(users.saveSession).toHaveBeenCalled()
    expect(result).toMatchObject({
      access_token: 'access-token',
      user: {
        id: 'u-p7',
        username: 'p7-admin',
        roles: ['P7'],
      },
    })
  })

  it('authenticates admin accounts when hash metadata is absent', async () => {
    const legacyHash = await argon2.hash('123456')
    users.findByUsername.mockResolvedValue({
      user_id: 'u-admin',
      username: 'admin',
      fullname: 'Admin',
      department: 'CNTT',
      max_security_level: 4,
      roles: ['ADMIN'],
      password_hash: legacyHash,
      hash_algorithm: null,
    })
    redis.isAccountLocked.mockResolvedValue(true)

    const result = await service.login('admin', '123456', '127.0.0.1', 'jest-agent')

    expect(redis.isAccountLocked).not.toHaveBeenCalled()
    expect(users.saveSession).toHaveBeenCalled()
    expect(result).toMatchObject({
      access_token: 'access-token',
      user: {
        id: 'u-admin',
        username: 'admin',
        roles: ['ADMIN'],
      },
    })
  })

  it('still blocks non-admin accounts that are temporarily locked', async () => {
    users.findByUsername.mockResolvedValue({
      user_id: 'u-student',
      username: 'student01',
      fullname: 'Student',
      department: 'P2',
      max_security_level: 1,
      roles: ['HOC_VIEN'],
      password_hash: passwordHash,
      hash_algorithm: 'argon2id',
    })
    redis.isAccountLocked.mockResolvedValue(true)
    redis.ttl.mockResolvedValue(300)

    await expect(
      service.login('student01', 'correct-password', '127.0.0.1', 'jest-agent'),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    expect(redis.isAccountLocked).toHaveBeenCalledWith('student01')
    expect(users.saveSession).not.toHaveBeenCalled()
  })

  it('revokes the current session id on logout', async () => {
    await service.logout(
      'refresh-token',
      'u-p7',
      'session-1',
      '127.0.0.1',
      'jest-agent',
    )

    expect(users.revokeSessionById).toHaveBeenCalledWith('session-1')
    expect(tokenRevocations.revokeAccessForSession).toHaveBeenCalledWith(
      'session-1',
    )
    expect(users.revokeSessionByRefreshHash).not.toHaveBeenCalled()
    expect(users.logLogin).toHaveBeenCalledWith(
      'u-p7',
      'logout',
      '127.0.0.1',
      'jest-agent',
      true,
    )
  })
})
