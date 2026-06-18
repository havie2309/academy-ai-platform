import { Injectable } from '@nestjs/common';

@Injectable()
export class ApiGatewayService {
  async getHealth() {
    const userMgmtUrl =
      process.env.USER_MANAGEMENT_URL ?? 'http://127.0.0.1:3001';
    const chatUrl = process.env.CHAT_URL ?? 'http://127.0.0.1:3002';
    const ragUrl = process.env.RAG_ENGINE_URL ?? 'http://127.0.0.1:8000';

    let userManagement: 'up' | 'down' = 'down';
    let chat: 'up' | 'down' = 'down';
    let rag: 'up' | 'down' = 'down';

    try {
      const res = await fetch(`${userMgmtUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
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

    const allUp = userManagement === 'up' && chat === 'up' && rag === 'up';

    return {
      status: allUp ? 'ok' : userManagement === 'up' ? 'degraded' : 'degraded',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      upstream: { userManagement, chat, rag },
    };
  }
}
