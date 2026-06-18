import { NestFactory } from '@nestjs/core'
import { UserManagementModule } from './user-management.module'

async function bootstrap() {
  const app = await NestFactory.create(UserManagementModule)
  app.enableCors({
    origin: process.env.WEB_URL ?? 'http://localhost:5173',
    credentials: true,
  })
  app.setGlobalPrefix('api')
  await app.listen(process.env.USER_MANAGEMENT_PORT ?? 3001)
}
bootstrap()