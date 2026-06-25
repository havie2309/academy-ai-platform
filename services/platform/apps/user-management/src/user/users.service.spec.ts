import { UsersService } from './users.service'

describe('UsersService', () => {
  let redis: {
    keys: jest.Mock
  }
  let service: UsersService
  let poolQuery: jest.Mock

  beforeEach(() => {
    redis = {
      keys: jest.fn(),
    }

    service = new UsersService({} as never, redis as never)
    poolQuery = jest.fn()
    ;(service as any).pool = {
      query: poolQuery,
    }

    jest
      .spyOn(service as any, 'getChatUsageByUserIds')
      .mockResolvedValue(new Map())
  })

  it('falls back to nullable auth metadata columns for legacy user schemas', async () => {
    poolQuery.mockResolvedValue({
      rows: [{ user_id: 'u-admin', username: 'admin', password_hash: '$2b$hash' }],
    })

    const user = await service.findByUsername('admin')

    expect(user).toMatchObject({ username: 'admin' })
    expect(poolQuery).toHaveBeenCalledWith(
      expect.stringContaining('NULL::varchar AS password_salt'),
      ['admin'],
    )
    expect(poolQuery).toHaveBeenCalledWith(
      expect.stringContaining('NULL::integer AS hash_iterations'),
      ['admin'],
    )
    expect(poolQuery).toHaveBeenCalledWith(
      expect.stringContaining('NULL::varchar AS hash_algorithm'),
      ['admin'],
    )
  })

  it('does not surface temporary login locks for admin-like accounts', async () => {
    const now = new Date('2026-06-25T04:00:00.000Z')

    poolQuery
      .mockResolvedValueOnce({
        rows: [
          {
            user_id: 'u-admin',
            username: 'admin',
            email: 'admin@example.com',
            fullname: 'Admin User',
            department: 'P7',
            max_security_level: 3,
            status: 'active',
            last_login_at: now,
            roles: ['P7'],
            active_refresh_sessions: 1,
            last_refreshed_at: now,
            failed_logins_7d: 0,
            refreshes_7d: 2,
          },
          {
            user_id: 'u-student',
            username: 'student01',
            email: 'student01@example.com',
            fullname: 'Student 01',
            department: 'P2',
            max_security_level: 1,
            status: 'active',
            last_login_at: now,
            roles: ['HOC_VIEN'],
            active_refresh_sessions: 0,
            last_refreshed_at: null,
            failed_logins_7d: 2,
            refreshes_7d: 0,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ username: 'admin' }],
      })

    redis.keys.mockResolvedValue([
      'login:locked:admin',
      'login:locked:student01',
    ])

    const accounts = await service.listManagedAccounts({ limit: 2 })
    const adminAccount = accounts.find((account) => account.username === 'admin')
    const studentAccount = accounts.find((account) => account.username === 'student01')

    expect(adminAccount?.temporary_locked).toBe(false)
    expect(studentAccount?.temporary_locked).toBe(true)
  })
})
