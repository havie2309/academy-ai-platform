import http from 'node:http'
import { resolve } from 'node:path'
import { config as loadEnv } from 'dotenv'
import { NestFactory } from '@nestjs/core'
import { ExpressAdapter } from '@nestjs/platform-express'
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { ApiGatewayModule } from './api-gateway.module'
import {
  attachGatewayUserHeaders,
  createGatewayAuthMiddleware,
  type GatewayRequest,
} from './gateway-auth'

// Load services/platform/.env so JWT_SECRET matches user-management + chat.
loadEnv({ path: resolve(__dirname, '../../../.env') })

async function bootstrap() {
  const userMgmt =
    process.env.USER_MANAGEMENT_URL ?? 'http://127.0.0.1:3001'
  const chatUrl = process.env.CHAT_URL ?? 'http://127.0.0.1:3002'
  const ragUrl = process.env.RAG_ENGINE_URL ?? 'http://127.0.0.1:8000'
  const jwtSecret = process.env.JWT_SECRET ?? 'dev-secret'

  const server = express()

  // Disable upstream keep-alive to avoid reusing half-closed SSE sockets.
  const noKeepAliveAgent = new http.Agent({ keepAlive: false })

  server.use(createGatewayAuthMiddleware(jwtSecret))

  server.use(
    createProxyMiddleware({
      target: userMgmt,
      changeOrigin: true,
      agent: noKeepAliveAgent,
      pathFilter: (pathname) =>
        pathname.startsWith('/api/auth') || pathname.startsWith('/api/users'),
      on: {
        proxyReq(proxyReq, req) {
          attachGatewayUserHeaders(req as GatewayRequest, (name, value) => {
            proxyReq.setHeader(name, value)
          })
        },
      },
    }),
  )

  server.use(
    createProxyMiddleware({
      target: chatUrl,
      changeOrigin: true,
      agent: noKeepAliveAgent,
      pathFilter: (pathname) =>
        pathname.startsWith('/api/chat') ||
        pathname.startsWith('/api/documents'),
      proxyTimeout: 0,
      timeout: 0,
      on: {
        proxyReq(proxyReq, req) {
          attachGatewayUserHeaders(req as GatewayRequest, (name, value) => {
            proxyReq.setHeader(name, value)
          })
        },
      },
    }),
  )

  server.use(
    createProxyMiddleware({
      target: ragUrl,
      changeOrigin: true,
      agent: noKeepAliveAgent,
      pathFilter: (pathname) => pathname.startsWith('/api/rag'),
      pathRewrite: (path) => path.replace(/^\/api\/rag/, ''),
      proxyTimeout: 0,
      timeout: 0,
      on: {
        proxyReq(proxyReq, req) {
          attachGatewayUserHeaders(req as GatewayRequest, (name, value) => {
            proxyReq.setHeader(name, value)
          })
        },
      },
    }),
  )

  const app = await NestFactory.create(
    ApiGatewayModule,
    new ExpressAdapter(server),
  )

  app.enableCors({
    origin: (
      process.env.WEB_URL ??
      'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174'
    )
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
  })

  const port = process.env.APP_PORT ?? 3000
  await app.listen(port)
  console.log(`api-gateway listening on http://localhost:${port}`)
}
bootstrap()
