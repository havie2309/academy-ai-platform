import { NestFactory } from '@nestjs/core'
import { ChatModule } from './chat.module'

async function bootstrap() {
  const app = await NestFactory.create(ChatModule)
  app.enableCors({ origin: process.env.WEB_URL ?? 'http://localhost:5173' })
  app.setGlobalPrefix('api')
  const port = process.env.CHAT_PORT ?? 3002
  await app.listen(port)
  console.log(`chat service listening on http://localhost:${port}`)
}
bootstrap()
