import { Controller, Get } from '@nestjs/common';
import { WorkflowService } from './workflow.service';

@Controller()
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get()
  getHello(): string {
    return this.workflowService.getHello();
  }
}
