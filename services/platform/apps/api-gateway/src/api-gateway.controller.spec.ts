import { Test, TestingModule } from '@nestjs/testing';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';

describe('ApiGatewayController', () => {
  let apiGatewayController: ApiGatewayController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ApiGatewayController],
      providers: [ApiGatewayService],
    }).compile();

    apiGatewayController = app.get<ApiGatewayController>(ApiGatewayController);
  });

  it('health returns gateway payload', async () => {
    const result = await apiGatewayController.health();
    expect(result.service).toBe('api-gateway');
    expect(result.upstream).toBeDefined();
  });
});
