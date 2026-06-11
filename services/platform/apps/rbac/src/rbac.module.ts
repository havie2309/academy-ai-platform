import { Module } from '@nestjs/common';
import { CommonModule } from '../../../src/common/common.module';
import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';

@Module({
  imports: [CommonModule],
  controllers: [RbacController],
  providers: [RbacService],
})
export class RbacModule {}
