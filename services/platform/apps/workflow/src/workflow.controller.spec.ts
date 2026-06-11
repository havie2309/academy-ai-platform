import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

describe('WorkflowController', () => {
  let workflowController: WorkflowController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [WorkflowController],
      providers: [WorkflowService],
    }).compile();

    workflowController = app.get<WorkflowController>(WorkflowController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(workflowController.getHello()).toBe('Hello World!');
    });
  });
});
