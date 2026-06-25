import { NestFactory } from '@nestjs/core'
import { UserManagementModule } from './user-management.module'

async function bootstrap() {
  const app = await NestFactory.create(UserManagementModule)
  app.enableCors({
    origin: process.env.WEB_URL ?? 'http://localhost:5173',
    credentials: true,
  })
  app.setGlobalPrefix('api')
  const port = process.env.USER_MANAGEMENT_PORT ?? 3001
  await app.listen(port)
  console.log(`user-management listening on http://localhost:${port}`)
}
bootstrap()
