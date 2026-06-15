import http from 'node:http';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ApiGatewayModule } from './api-gateway.module';

async function bootstrap() {
  const userMgmt =
    process.env.USER_MANAGEMENT_URL ?? 'http://localhost:3001';
  const chatUrl = process.env.CHAT_URL ?? 'http://localhost:3002';

  const server = express();

  // Tắt keep-alive cho upstream: tránh tái dùng socket đã bị nửa-đóng sau khi
  // một stream SSE bị abort, nguyên nhân gây HTTP 400 ngắt quãng cho request kế tiếp.
  const noKeepAliveAgent = new http.Agent({ keepAlive: false });

  server.use(
    createProxyMiddleware({
      target: userMgmt,
      changeOrigin: true,
      agent: noKeepAliveAgent,
      pathFilter: (pathname) =>
        pathname.startsWith('/api/auth') || pathname.startsWith('/api/users'),
    }),
  );

  server.use(
    createProxyMiddleware({
      target: chatUrl,
      changeOrigin: true,
      agent: noKeepAliveAgent,
      pathFilter: (pathname) => pathname.startsWith('/api/chat'),
      proxyTimeout: 0,
      timeout: 0,
    }),
  );

  const app = await NestFactory.create(ApiGatewayModule, new ExpressAdapter(server));

  app.enableCors({
    origin: process.env.WEB_URL ?? 'http://localhost:5173',
    credentials: true,
  });

  const port = process.env.APP_PORT ?? 3000;
  await app.listen(port);
  console.log(`api-gateway listening on http://localhost:${port}`);
}
bootstrap();
