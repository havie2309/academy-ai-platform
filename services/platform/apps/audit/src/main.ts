import { NestFactory } from '@nestjs/core'
import { AuditModule } from './audit.module'

async function bootstrap() {
  const app = await NestFactory.create(AuditModule)
  app.enableCors({ origin: process.env.WEB_URL ?? 'http://localhost:5173' })
  app.setGlobalPrefix('api')
  await app.listen(process.env.AUDIT_PORT ?? 3005)
}
bootstrap()
