import { Test, TestingModule } from '@nestjs/testing'
import { ApiGatewayController } from './api-gateway.controller'
import { ApiGatewayService } from './api-gateway.service'

describe('ApiGatewayController', () => {
  let apiGatewayController: ApiGatewayController

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ApiGatewayController],
      providers: [
        {
          provide: ApiGatewayService,
          useValue: {
            getHealth: jest.fn().mockResolvedValue({
              service: 'api-gateway',
              upstream: { userManagement: 'up', chat: 'up', rag: 'up', etl: 'up' },
            }),
          },
        },
      ],
    }).compile()

    apiGatewayController = app.get<ApiGatewayController>(ApiGatewayController)
  })

  it('health returns gateway payload', async () => {
    const result = await apiGatewayController.health()
    expect(result.service).toBe('api-gateway')
    expect(result.upstream).toBeDefined()
  })
})
