import http from 'node:http';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ApiGatewayModule } from './api-gateway.module';
import {
  attachGatewayUserHeaders,
  createGatewayAuthMiddleware,
  type GatewayRequest,
} from './gateway-auth';
import { createGatewayAuditMiddleware } from './gateway-audit';
import { createRateLimitMiddleware } from './rate-limit';
import { createLoadSheddingMiddleware } from './load-shedding';
import { createCircuitBreakerMiddleware } from './circuit-breaker-middleware';
import { CircuitBreaker } from './circuit-breaker';
import { RedisService } from '../../../src/common/redis/redis.service';
import { ConfigService } from '@nestjs/config';

// Load services/platform/.env so JWT_SECRET matches user-management + chat.
loadEnv({ path: resolve(__dirname, '../../../.env') });

async function bootstrap() {
  const userMgmt =
    process.env.USER_MANAGEMENT_URL ?? 'http://127.0.0.1:3001';
  const chatUrl = process.env.CHAT_URL ?? 'http://127.0.0.1:3002';
  const rbacUrl = process.env.RBAC_URL ?? 'http://127.0.0.1:3003';
  const adminConfigUrl = process.env.ADMIN_CONFIG_URL ?? 'http://127.0.0.1:3004';
  const auditUrl = process.env.AUDIT_URL ?? 'http://127.0.0.1:3005';
  const ragUrl = process.env.RAG_ENGINE_URL ?? 'http://127.0.0.1:8000';
  const jwtSecret = process.env.JWT_SECRET ?? 'dev-secret';

  const server = express();

  const noKeepAliveAgent = new http.Agent({ keepAlive: false });

  // ──────────────────────────────────────────────────────────────
  // 1. Create the NestJS app early to get services
  // ──────────────────────────────────────────────────────────────
  const app = await NestFactory.create(
    ApiGatewayModule,
    new ExpressAdapter(server),
  );

  app.enableCors({
    origin: (
      process.env.WEB_URL ??
      'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174'
    )
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
  });

  // Get services from the app context
  const redisService = app.get(RedisService);
  const configService = app.get(ConfigService);

  // ──────────────────────────────────────────────────────────────
  // 2. Middleware Order (top to bottom)
  // ──────────────────────────────────────────────────────────────

  // 2a. Load shedding (global concurrency) – first line of defense
  server.use(createLoadSheddingMiddleware(redisService, configService));

  // 2b. Block internal admin-config endpoint (for security)
  server.use('/api/admin-config/internal', (_req, res) => {
    res.status(404).json({ message: 'not found' });
  });

  // 2c. Audit logging
  server.use(createGatewayAuditMiddleware());

  // 2d. JWT Authentication
  server.use(createGatewayAuthMiddleware(jwtSecret));

  // 2e. Rate limiting (per user/IP)
  server.use(createRateLimitMiddleware(redisService, configService));

  // ──────────────────────────────────────────────────────────────
  // 3. Circuit Breaker instances for each upstream service
  // ──────────────────────────────────────────────────────────────
  const circuitBreaker = new CircuitBreaker(redisService, configService);

  const userMgmtCircuit = createCircuitBreakerMiddleware(circuitBreaker, 'userMgmt');
  const chatCircuit = createCircuitBreakerMiddleware(circuitBreaker, 'chat');
  const ragCircuit = createCircuitBreakerMiddleware(circuitBreaker, 'rag');
  const rbacCircuit = createCircuitBreakerMiddleware(circuitBreaker, 'rbac');
  const adminConfigCircuit = createCircuitBreakerMiddleware(circuitBreaker, 'adminConfig');
  const auditCircuit = createCircuitBreakerMiddleware(circuitBreaker, 'audit');

  // ──────────────────────────────────────────────────────────────
  // 4. Register Proxies with Circuit Breakers
  // ──────────────────────────────────────────────────────────────

  // User Management
  server.use('/api/auth', userMgmtCircuit);
  server.use('/api/users', userMgmtCircuit);
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
            proxyReq.setHeader(name, value);
          });
        },
      },
    }),
  );

  // Chat + Documents
  server.use('/api/chat', chatCircuit);
  server.use('/api/documents', chatCircuit);
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
            proxyReq.setHeader(name, value);
          });
        },
      },
    }),
  );

  // RAG
  server.use('/api/rag', ragCircuit);
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
            proxyReq.setHeader(name, value);
          });
        },
      },
    }),
  );

  // RBAC
  server.use('/api/rbac', rbacCircuit);
  server.use(
    createProxyMiddleware({
      target: rbacUrl,
      changeOrigin: true,
      agent: noKeepAliveAgent,
      pathFilter: (pathname) => pathname.startsWith('/api/rbac'),
      on: {
        proxyReq(proxyReq, req) {
          attachGatewayUserHeaders(req as GatewayRequest, (name, value) => {
            proxyReq.setHeader(name, value);
          });
        },
      },
    }),
  );

  // Admin Config
  server.use('/api/admin-config', adminConfigCircuit);
  server.use(
    createProxyMiddleware({
      target: adminConfigUrl,
      changeOrigin: true,
      agent: noKeepAliveAgent,
      pathFilter: (pathname) => pathname.startsWith('/api/admin-config'),
      on: {
        proxyReq(proxyReq, req) {
          attachGatewayUserHeaders(req as GatewayRequest, (name, value) => {
            proxyReq.setHeader(name, value);
          });
        },
      },
    }),
  );

  // Audit
  server.use('/api/audit', auditCircuit);
  server.use(
    createProxyMiddleware({
      target: auditUrl,
      changeOrigin: true,
      agent: noKeepAliveAgent,
      pathFilter: (pathname) => pathname.startsWith('/api/audit'),
      on: {
        proxyReq(proxyReq, req) {
          attachGatewayUserHeaders(req as GatewayRequest, (name, value) => {
            proxyReq.setHeader(name, value);
          });
        },
      },
    }),
  );

  // ──────────────────────────────────────────────────────────────
  // 5. Start the server
  // ──────────────────────────────────────────────────────────────
  const port = process.env.APP_PORT ?? 3000;
  await app.listen(port);
  console.log(`api-gateway listening on http://localhost:${port}`);
}
bootstrap();