import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
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
  const config = {
    get: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    config.get.mockReturnValue(undefined)
  })

  it('builds filtered audit queries and caps export limit', async () => {
    const pg = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    }
    const service = new AuditService(
      config as any,
      pg as any,
      securityAlerts as any,
    )

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
    const service = new AuditService(
      config as any,
      pg as any,
      securityAlerts as any,
    )

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
    const service = new AuditService(
      config as any,
      pg as any,
      securityAlerts as any,
    )

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
    const service = new AuditService(
      config as any,
      pg as any,
      securityAlerts as any,
    )

    await expect(
      service.updateSecurityAlertStatus(adminUser, '15', 'paused'),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('reads filtered service logs from configured log roots', async () => {
    const pg = {
      query: jest.fn(),
    }
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pm2-audit-logs-'))
    const logDir = path.join(tmpRoot, 'logs')
    await fs.mkdir(logDir, { recursive: true })
    await fs.writeFile(
      path.join(logDir, 'rag-engine.log'),
      [
        '2026-06-30T09:10:00.000Z [info] boot completed',
        '2026-06-30T09:11:00.000Z [error] upstream timeout',
      ].join('\n'),
      'utf8',
    )
    config.get.mockImplementation((key: string) =>
      key === 'ADMIN_SERVICE_LOG_DIRS' ? logDir : undefined,
    )
    const service = new AuditService(
      config as any,
      pg as any,
      securityAlerts as any,
    )

    try {
      const result = await service.listServiceLogs(adminUser, {
        service: 'rag-engine',
        level: 'error',
        search: 'timeout',
        from: '2026-06-30T09:00:00.000Z',
        to: '2026-06-30T10:00:00.000Z',
        limit: '10',
      })

      expect(result.entries).toHaveLength(1)
      expect(result.entries[0]).toMatchObject({
        service: 'rag-engine',
        level: 'error',
        message: 'upstream timeout',
      })
      expect(
        result.services.find((item) => item.key === 'rag-engine'),
      ).toMatchObject({
        available: true,
        file_count: 1,
      })
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true })
    }
  })

  it('rejects invalid service log filters', async () => {
    const pg = {
      query: jest.fn(),
    }
    const service = new AuditService(
      config as any,
      pg as any,
      securityAlerts as any,
    )

    await expect(
      service.listServiceLogs(adminUser, {
        service: '../secrets',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
