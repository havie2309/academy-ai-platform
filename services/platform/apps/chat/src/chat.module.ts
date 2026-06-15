import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule, JwtSignOptions } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { CommonModule } from '../../../src/common/common.module'
import { JwtStrategy } from './auth/jwt.strategy'
import { ChatController } from './chat/chat.controller'
import { ChatService } from './chat/chat.service'
import { DocumentsController } from './documents/documents.controller'
import { DocumentsService } from './documents/documents.service'

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
  controllers: [ChatController, DocumentsController],
  providers: [ChatService, DocumentsService, JwtStrategy],
})
export class ChatModule {}
