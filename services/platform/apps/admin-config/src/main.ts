import { NestFactory } from '@nestjs/core'
import { AdminConfigModule } from './admin-config.module'

async function bootstrap() {
  const app = await NestFactory.create(AdminConfigModule)
  app.enableCors({ origin: process.env.WEB_URL ?? 'http://localhost:5173' })
  app.setGlobalPrefix('api')
  await app.listen(process.env.ADMIN_CONFIG_PORT ?? 3004)
}
bootstrap()
