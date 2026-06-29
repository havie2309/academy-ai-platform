import { EventEmitter } from 'node:events'
import type { Response } from 'express'
import { createGatewayAuditMiddleware } from './gateway-audit'
import type { GatewayRequest } from './gateway-auth'

jest.mock('../../../src/common/audit-log', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}))

describe('gateway-audit', () => {
  it('creates a privileged probe alert and revokes the current session after repeated denied ETL access', async () => {
    const redis = {
      increment: jest.fn((key: string) => {
        if (key.includes('privileged-probe')) {
          return Promise.resolve(2)
        }
        return Promise.resolve(1)
      }),
    }
    const securityAlerts = {
      safeRecordAlert: jest.fn().mockResolvedValue({ id: 91 }),
      markAutoAction: jest.fn().mockResolvedValue(undefined),
    }
    const securityResponses = {
      revokeSession: jest.fn().mockResolvedValue(true),
      lockUserAccount: jest.fn().mockResolvedValue(false),
    }
    const middleware = createGatewayAuditMiddleware(
      redis as any,
      securityAlerts as any,
      securityResponses as any,
    )
    const req = {
      method: 'GET',
      path: '/api/etl/jobs',
      originalUrl: '/api/etl/jobs',
      url: '/api/etl/jobs',
      ip: '203.0.113.77',
      headers: {
        'user-agent': 'jest',
      },
      gatewayUser: {
        userId: 'u-hv',
        username: 'hv001',
        roles: ['HOC_VIEN'],
        normalizedRoles: ['HOC_VIEN'],
        department: null,
        maxSecurityLevel: 1,
        scopeMaHv: '666106',
        scopeMaGv: null,
        sessionId: 'session-1',
      },
    } as GatewayRequest
    const res = mockResponse(403)
    const next = jest.fn()

    middleware(req, res, next)
    res.emit('finish')
    await flushAsyncWork()

    expect(next).toHaveBeenCalledTimes(1)
    expect(securityAlerts.safeRecordAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleCode: 'gateway.privileged_probe',
        sessionId: 'session-1',
        userId: 'u-hv',
      }),
    )
    expect(securityResponses.revokeSession).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        alertId: 91,
        userId: 'u-hv',
      }),
    )
    expect(securityAlerts.markAutoAction).toHaveBeenCalledWith(
      91,
      expect.objectContaining({
        action: 'revoke_session',
        status: 'applied',
      }),
    )
  })
})

function mockResponse(statusCode: number): Response & EventEmitter {
  const res = new EventEmitter() as Response & EventEmitter
  res.statusCode = statusCode
  return res
}

async function flushAsyncWork() {
  await new Promise((resolve) => setImmediate(resolve))
}
