import { UnauthorizedException } from '@nestjs/common'
import { hashSync } from 'bcrypt'
import { AuthService } from './auth.service'
import { pbkdf2Sync } from 'node:crypto'

function buildPasswordRecord(password: string, salt = 'spec-salt') {
  const iterations = 1000
  const digest = 'sha256'
  const password_hash = pbkdf2Sync(password, salt, iterations, 32, digest).toString('hex')

  return {
    password_hash,
    password_salt: salt,
    hash_iterations: iterations,
    hash_algorithm: `pbkdf2_${digest}`,
  }
}

describe('AuthService', () => {
  const passwordRecord = buildPasswordRecord('correct-password')

  let users: {
    findByUsername: jest.Mock
    saveSession: jest.Mock
    updateLastLogin: jest.Mock
    logLogin: jest.Mock
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
  let service: AuthService

  beforeEach(() => {
    users = {
      findByUsername: jest.fn(),
      saveSession: jest.fn().mockResolvedValue('session-1'),
      updateLastLogin: jest.fn().mockResolvedValue(undefined),
      logLogin: jest.fn().mockResolvedValue(undefined),
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

    service = new AuthService(
      users as never,
      jwt as never,
      config as never,
      redis as never,
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
      ...passwordRecord,
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
    expect(jwt.sign).toHaveBeenCalled()
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

  it('authenticates legacy bcrypt admin accounts when PBKDF2 columns are absent', async () => {
    users.findByUsername.mockResolvedValue({
      user_id: 'u-admin',
      username: 'admin',
      fullname: 'Admin',
      department: 'CNTT',
      max_security_level: 4,
      roles: ['ADMIN'],
      password_hash: hashSync('123456', 10),
      password_salt: null,
      hash_iterations: null,
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
      ...passwordRecord,
    })
    redis.isAccountLocked.mockResolvedValue(true)
    redis.ttl.mockResolvedValue(300)

    await expect(
      service.login('student01', 'correct-password', '127.0.0.1', 'jest-agent'),
    ).rejects.toBeInstanceOf(UnauthorizedException)

    expect(redis.isAccountLocked).toHaveBeenCalledWith('student01')
    expect(users.saveSession).not.toHaveBeenCalled()
  })
})
