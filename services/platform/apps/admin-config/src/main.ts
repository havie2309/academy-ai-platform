import { NestFactory } from '@nestjs/core'
import { AdminConfigModule } from './admin-config.module'

async function bootstrap() {
  const app = await NestFactory.create(AdminConfigModule)
  app.enableCors({ origin: process.env.WEB_URL ?? 'http://localhost:5173' })
  app.setGlobalPrefix('api')
  const port = process.env.ADMIN_CONFIG_PORT ?? 3004
  await app.listen(port)
  console.log(`admin-config listening on http://localhost:${port}`)
}
bootstrap()
