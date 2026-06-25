import { Test, TestingModule } from '@nestjs/testing'
import { AdminConfigController } from './admin-config.controller'
import { AdminConfigService } from './admin-config.service'

describe('AdminConfigController', () => {
  let adminConfigController: AdminConfigController

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AdminConfigController],
      providers: [
        {
          provide: AdminConfigService,
          useValue: {
            getRagPolicy: jest.fn().mockResolvedValue({
              config_key: 'rag_policy',
              version: 1,
              updated_at: '2026-06-18T00:00:00.000Z',
              value: {
                enabled: true,
                guardrailRules: [
                  {
                    id: 'default-keyword-blocklist',
                    label: 'Danh sach tu khoa bi chan',
                    enabled: true,
                    phrases: ['mat khau he thong'],
                  },
                ],
                safeRefusalMessage: 'blocked',
              },
            }),
            canManagePolicy: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile()

    adminConfigController =
      app.get<AdminConfigController>(AdminConfigController)
  })

  it('returns health payload', () => {
    expect(adminConfigController.health()).toEqual({
      status: 'ok',
      service: 'admin-config',
    })
  })
})
