import { NestFactory } from '@nestjs/core'
import { RbacModule } from './rbac.module'

async function bootstrap() {
  const app = await NestFactory.create(RbacModule)
  app.enableCors({ origin: process.env.WEB_URL ?? 'http://localhost:5173' })
  app.setGlobalPrefix('api')
  await app.listen(process.env.RBAC_PORT ?? 3003)
}
bootstrap()
