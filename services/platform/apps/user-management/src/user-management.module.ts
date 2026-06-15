import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { JwtModule, JwtSignOptions } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { CommonModule } from '../../../src/common/common.module'
import { AuthController } from './auth/auth.controller'
import { AuthService } from './auth/auth.service'
import { JwtStrategy } from './auth/jwt.strategy'
import { UsersController } from './user/users.controller'
import { UsersService } from './user/users.service'

const jwtExpiresIn = (process.env.JWT_EXPIRES_IN ?? '8h') as JwtSignOptions['expiresIn']

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: jwtExpiresIn },
      global: true,
    }),
    CommonModule,
  ],
  controllers: [AuthController, UsersController],
  providers: [AuthService, UsersService, JwtStrategy],
})
export class UserManagementModule {}