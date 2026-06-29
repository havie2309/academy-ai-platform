import { BadRequestException, ForbiddenException } from '@nestjs/common'
import type { AuthUser } from '../../../src/common/auth.types'
import { AuditService } from './audit.service'

describe('AuditService', () => {
  const adminUser: AuthUser = {
    userId: 'u-admin',
    username: 'admin',
    roles: ['ADMIN'],
    department: 'P2',
    maxSecurityLevel: 4,
  }

  const securityAlerts = {
    getAlert: jest.fn(),
    listAlerts: jest.fn(),
    updateAlertStatus: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
})

  it('builds filtered audit queries and caps export limit', async () => {
    const pg = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    }
    const service = new AuditService(pg as any, securityAlerts as any)

    await service.listLogs(adminUser, {
      status: 'denied',
      action: 'get',
      resourceType: 'audit',
      userId: 'u-admin',
      resourceId: 'logs/123',
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-19T23:59:59.000Z',
      limit: '9999',
    })

    const [query, params] = pg.query.mock.calls[0] as [string, unknown[]]
    expect(query).toContain('status = $1')
    expect(query).toContain('action = $2')
    expect(query).toContain('resource_type = $3')
    expect(query).toContain('user_id = $4')
    expect(query).toContain('resource_id = $5')
    expect(query).toContain('created_at >= $6')
    expect(query).toContain('created_at <= $7')
    expect(params).toEqual([
      'denied',
      'get',
      'audit',
      'u-admin',
      'logs/123',
      '2026-06-01T00:00:00.000Z',
      '2026-06-19T23:59:59.000Z',
      500,
    ])
  })

  it('blocks non-admin users from reading audit logs', async () => {
    const pg = {
      query: jest.fn(),
    }
    const service = new AuditService(pg as any, securityAlerts as any)

    await expect(
      service.listLogs(
        {
          ...adminUser,
          roles: ['HOC_VIEN'],
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('delegates security alert listing to the shared alert store', async () => {
    const pg = {
      query: jest.fn(),
    }
    securityAlerts.listAlerts.mockResolvedValue([{ id: 1 }])
    const service = new AuditService(pg as any, securityAlerts as any)

    const result = await service.listSecurityAlerts(adminUser, {
      severity: 'high',
      status: 'open',
      limit: '20',
    })

    expect(securityAlerts.listAlerts).toHaveBeenCalledWith({
      severity: 'high',
      status: 'open',
      limit: '20',
    })
    expect(result).toEqual([{ id: 1 }])
  })

  it('rejects invalid security alert status updates', async () => {
    const pg = {
      query: jest.fn(),
    }
    const service = new AuditService(pg as any, securityAlerts as any)

    await expect(
      service.updateSecurityAlertStatus(adminUser, '15', 'paused'),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
