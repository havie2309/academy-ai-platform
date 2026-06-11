import { Module } from '@nestjs/common';
import { CommonModule } from '../../../src/common/common.module';
import { AdminConfigController } from './admin-config.controller';
import { AdminConfigService } from './admin-config.service';

@Module({
  imports: [CommonModule],
  controllers: [AdminConfigController],
  providers: [AdminConfigService],
})
export class AdminConfigModule {}
