import { Module } from '@nestjs/common';
import { CommonModule } from '../../../src/common/common.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  imports: [CommonModule],
  controllers: [AuditController],
  providers: [AuditService],
})
export class AuditModule {}
