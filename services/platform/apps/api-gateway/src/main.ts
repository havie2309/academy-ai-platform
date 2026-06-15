import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { createProxyMiddleware } from 'http-proxy-middleware';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);

  app.enableCors({
    origin: process.env.WEB_URL ?? 'http://localhost:5173',
    credentials: true,
  });

  const userMgmt =
    process.env.USER_MANAGEMENT_URL ?? 'http://localhost:3001';
  const chatUrl = process.env.CHAT_URL ?? 'http://localhost:3002';
  const expressApp = app.getHttpAdapter().getInstance();

  expressApp.use(
    createProxyMiddleware({
      target: userMgmt,
      changeOrigin: true,
      pathFilter: (pathname) =>
        pathname.startsWith('/api/auth') || pathname.startsWith('/api/users'),
    }),
  );

  expressApp.use(
    createProxyMiddleware({
      target: chatUrl,
      changeOrigin: true,
      pathFilter: (pathname) => pathname.startsWith('/api/chat'),
      proxyTimeout: 0,
      timeout: 0,
    }),
  );

  const port = process.env.APP_PORT ?? 3000;
  await app.listen(port);
  console.log(`api-gateway listening on http://localhost:${port}`);
}
bootstrap();
