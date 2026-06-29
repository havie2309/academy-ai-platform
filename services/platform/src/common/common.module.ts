import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PostgresService } from './postgres.service'
import { LoggerMiddleware } from './logger.middleware'
import { RedisModule } from './redis/redis.module'
import { SecurityAlertsService } from './security-alerts.service'
import { SecurityResponseService } from './security-response.service'
import { TokenRevocationService } from './token-revocation.service'

@Module({
  imports: [ConfigModule, RedisModule],
  providers: [
    PostgresService,
    TokenRevocationService,
    SecurityAlertsService,
    SecurityResponseService,
  ],
  exports: [
    PostgresService,
    TokenRevocationService,
    SecurityAlertsService,
    SecurityResponseService,
    RedisModule,
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes({
      path: '*path',
      method: RequestMethod.ALL,
    })
  }
}
