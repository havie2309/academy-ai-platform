import { TokenRevocationService } from '../../../src/common/token-revocation.service'

describe('TokenRevocationService', () => {
  let config: {
    get: jest.Mock
  }
  let redis: {
    exists: jest.Mock
    get: jest.Mock
  }
  let service: TokenRevocationService

  beforeEach(() => {
    config = {
      get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
    }
    redis = {
      exists: jest.fn().mockResolvedValue(false),
      get: jest.fn().mockResolvedValue(null),
    }
    service = new TokenRevocationService(
      config as never,
      redis as never,
    )
  })

  it('allows tokens when revocation data is healthy and empty', async () => {
    await expect(
      service.isAccessTokenRevoked({
        sub: 'u1',
        sid: 'session-1',
        iat: Math.floor(Date.now() / 1000),
      }),
    ).resolves.toBe(false)
  })

  it('fails closed when Redis lookup throws', async () => {
    redis.exists.mockRejectedValue(new Error('redis unavailable'))

    await expect(
      service.isAccessTokenRevoked({
        sub: 'u1',
        sid: 'session-1',
        iat: Math.floor(Date.now() / 1000),
      }),
    ).resolves.toBe(true)
  })

  it('fails closed when revoke-all marker is invalid', async () => {
    redis.get.mockResolvedValue('not-a-timestamp')

    await expect(
      service.isAccessTokenRevoked({
        sub: 'u1',
        sid: 'session-1',
        iat: Math.floor(Date.now() / 1000),
      }),
    ).resolves.toBe(true)
  })
})
