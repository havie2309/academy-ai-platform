import { Injectable } from '@nestjs/common';

@Injectable()
export class ApiGatewayService {
  async getHealth() {
    const userMgmtUrl =
      process.env.USER_MANAGEMENT_URL ?? 'http://localhost:3001';
    const chatUrl = process.env.CHAT_URL ?? 'http://localhost:3002';

    let userManagement: 'up' | 'down' = 'down';
    let chat: 'up' | 'down' = 'down';

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

    const allUp = userManagement === 'up' && chat === 'up';

    return {
      status: allUp ? 'ok' : userManagement === 'up' ? 'degraded' : 'degraded',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      upstream: { userManagement, chat },
    };
  }
}
