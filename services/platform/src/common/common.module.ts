import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { PostgresService } from './postgres.service'
import { LoggerMiddleware } from './logger.middleware'

@Module({
  providers: [PostgresService],
  exports: [PostgresService],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*')
  }
}
