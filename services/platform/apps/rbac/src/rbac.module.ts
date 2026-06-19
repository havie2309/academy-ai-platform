import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { CommonJwtStrategy } from '../../../src/common/jwt.strategy'
import { CommonModule } from '../../../src/common/common.module'
import { RbacController } from './rbac.controller'
import { RbacService } from './rbac.service'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret'),
      }),
    }),
    CommonModule,
  ],
  controllers: [RbacController],
  providers: [RbacService, CommonJwtStrategy],
})
export class RbacModule {}
