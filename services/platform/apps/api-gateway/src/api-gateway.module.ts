import { Module } from '@nestjs/common';
import { CommonModule } from '../../../src/common/common.module';
import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { RedisModule } from '../../../src/common/redis/redis.module';

@Module({
  imports: [
    CommonModule,
    RedisModule,
  ],
  controllers: [ApiGatewayController],
  providers: [ApiGatewayService],
})
export class ApiGatewayModule {}
