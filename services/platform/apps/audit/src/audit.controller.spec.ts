import { Test, TestingModule } from '@nestjs/testing'
import { AuditController } from './audit.controller'
import { AuditService } from './audit.service'

describe('AuditController', () => {
  let auditController: AuditController

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditService,
          useValue: {
            listLogs: jest.fn(),
          },
        },
      ],
    }).compile()

    auditController = app.get<AuditController>(AuditController)
  })

  it('returns health payload', () => {
    expect(auditController.health()).toEqual({
      status: 'ok',
      service: 'audit',
    })
  })
})
