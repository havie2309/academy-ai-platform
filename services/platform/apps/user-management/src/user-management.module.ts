import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule, JwtSignOptions } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { CommonModule } from '../../../src/common/common.module'
import { AuthController } from './auth/auth.controller'
import { AuthService } from './auth/auth.service'
import { JwtStrategy } from './auth/jwt.strategy'
import { UsersController } from './user/users.controller'
import { UsersService } from './user/users.service'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const expiresIn = (config.get<string>('JWT_EXPIRES_IN') ?? '8h') as JwtSignOptions['expiresIn']
        return {
          secret: config.get<string>('JWT_SECRET', 'dev-secret'),
          signOptions: { expiresIn },
        }
      },
    }),
    CommonModule,
  ],
  controllers: [AuthController, UsersController],
  providers: [AuthService, UsersService, JwtStrategy],
})
export class UserManagementModule {}
