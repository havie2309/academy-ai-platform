import { Injectable } from '@nestjs/common';

@Injectable()
export class ApiGatewayService {
  async getHealth() {
    const userMgmtUrl =
      process.env.USER_MANAGEMENT_URL ?? 'http://127.0.0.1:3001';
    const chatUrl = process.env.CHAT_URL ?? 'http://127.0.0.1:3002';
    const rbacUrl = process.env.RBAC_URL ?? 'http://127.0.0.1:3003';
    const adminConfigUrl =
      process.env.ADMIN_CONFIG_URL ?? 'http://127.0.0.1:3004';
    const auditUrl = process.env.AUDIT_URL ?? 'http://127.0.0.1:3005';
    const ragUrl = process.env.RAG_ENGINE_URL ?? 'http://127.0.0.1:8000';

    let userManagement: 'up' | 'down' = 'down';
    let chat: 'up' | 'down' = 'down';
    let rbac: 'up' | 'down' = 'down';
    let adminConfig: 'up' | 'down' = 'down';
    let audit: 'up' | 'down' = 'down';
    let rag: 'up' | 'down' = 'down';

    try {
      const res = await fetch(`${userMgmtUrl}/api/auth/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      userManagement = res.status < 500 ? 'up' : 'down';
    } catch {
      userManagement = 'down';
    }

    try {
      const res = await fetch(`${chatUrl}/api/chat/sessions`, {
        method: 'GET',
        headers: { Authorization: 'Bearer ' },
        signal: AbortSignal.timeout(3000),
      });
      chat = res.status === 401 || res.status < 500 ? 'up' : 'down';
    } catch {
      chat = 'down';
    }

    try {
      const res = await fetch(`${ragUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      rag = res.status < 500 ? 'up' : 'down';
    } catch {
      rag = 'down';
    }

    try {
      const res = await fetch(`${rbacUrl}/api/rbac/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      rbac = res.status < 500 ? 'up' : 'down';
    } catch {
      rbac = 'down';
    }

    try {
      const res = await fetch(`${adminConfigUrl}/api/admin-config/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      adminConfig = res.status < 500 ? 'up' : 'down';
    } catch {
      adminConfig = 'down';
    }

    try {
      const res = await fetch(`${auditUrl}/api/audit/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      audit = res.status < 500 ? 'up' : 'down';
    } catch {
      audit = 'down';
    }

    const allUp =
      userManagement === 'up' &&
      chat === 'up' &&
      rag === 'up' &&
      rbac === 'up' &&
      adminConfig === 'up' &&
      audit === 'up';

    return {
      status: allUp ? 'ok' : 'degraded',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      upstream: { userManagement, chat, rbac, adminConfig, audit, rag },
    };
  }
}
