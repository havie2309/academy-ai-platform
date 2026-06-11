import { Module } from '@nestjs/common';
import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';

@Module({
  imports: [],
  controllers: [RbacController],
  providers: [RbacService],
})
export class RbacModule {}
