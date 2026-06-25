import { NestFactory } from '@nestjs/core'
import { AuditModule } from './audit.module'

async function bootstrap() {
  const app = await NestFactory.create(AuditModule)
  app.enableCors({ origin: process.env.WEB_URL ?? 'http://localhost:5173' })
  app.setGlobalPrefix('api')
  const port = process.env.AUDIT_PORT ?? 3005
  await app.listen(port)
  console.log(`audit listening on http://localhost:${port}`)
}
bootstrap()
