import { Module } from '@nestjs/common';
import { CommonModule } from '../../../src/common/common.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  imports: [CommonModule],
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class NotificationModule {}
