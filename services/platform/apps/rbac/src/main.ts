import { NestFactory } from '@nestjs/core'
import { RbacModule } from './rbac.module'

async function bootstrap() {
  const app = await NestFactory.create(RbacModule)
  app.enableCors({ origin: process.env.WEB_URL ?? 'http://localhost:5173' })
  app.setGlobalPrefix('api')
  const port = process.env.RBAC_PORT ?? 3003
  await app.listen(port)
  console.log(`rbac listening on http://localhost:${port}`)
}
bootstrap()
