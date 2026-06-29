const mockQuery = jest.fn()

jest.mock('../../../src/common/postgres.service', () => ({
  getSharedPostgresPool: () => ({
    query: mockQuery,
  }),
}))

describe('access-scope helpers', () => {
  beforeEach(() => {
    jest.resetModules()
    mockQuery.mockReset()
  })

  it('normalizes role aliases and admin-like roles', () => {
    jest.isolateModules(() => {
      const {
        isAdminLike,
        normalizeRoles,
      } = require('../../../src/common/access-scope')

      expect(normalizeRoles(['HocVien', 'GV', 'BGD', 'HocVien'])).toEqual([
        'HOC_VIEN',
        'GIANG_VIEN',
        'BGD',
      ])
      expect(isAdminLike(['BGD'])).toBe(true)
      expect(isAdminLike(['P7'])).toBe(true)
    })
  })

  it('resolves student self-scope from user_scope_bindings', async () => {
    mockQuery.mockResolvedValueOnce({})
    mockQuery.mockResolvedValueOnce({})
    mockQuery.mockResolvedValueOnce({})
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          bound_ma_hv: '631135',
          bound_ma_gv: null,
          ma_hv: null,
          ma_gv: null,
        },
      ],
    })

    let resolveAccessScope: typeof import('../../../src/common/access-scope').resolveAccessScope
    jest.isolateModules(() => {
      ;({ resolveAccessScope } = require('../../../src/common/access-scope'))
    })

    await expect(
      resolveAccessScope({
        userId: 'USRSMOKEHV',
        username: 'smoke_hv',
        roles: ['HocVien'],
        department: 'KTPM',
        maxSecurityLevel: 1,
      }),
    ).resolves.toMatchObject({
      normalizedRoles: ['HOC_VIEN'],
      scopeMaHv: '631135',
      scopeMaGv: null,
    })
  })
})
