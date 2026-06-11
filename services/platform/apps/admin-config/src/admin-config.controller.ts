import { Controller, Get } from '@nestjs/common';
import { AdminConfigService } from './admin-config.service';

@Controller()
export class AdminConfigController {
  constructor(private readonly adminConfigService: AdminConfigService) {}

  @Get()
  getHello(): string {
    return this.adminConfigService.getHello();
  }
}
