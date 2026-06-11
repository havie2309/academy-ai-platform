import { Test, TestingModule } from '@nestjs/testing';
import { AdminConfigController } from './admin-config.controller';
import { AdminConfigService } from './admin-config.service';

describe('AdminConfigController', () => {
  let adminConfigController: AdminConfigController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AdminConfigController],
      providers: [AdminConfigService],
    }).compile();

    adminConfigController = app.get<AdminConfigController>(AdminConfigController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(adminConfigController.getHello()).toBe('Hello World!');
    });
  });
});
