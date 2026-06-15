import { Injectable } from '@nestjs/common';

@Injectable()
export class ApiGatewayService {
  async getHealth() {
    const userMgmtUrl =
      process.env.USER_MANAGEMENT_URL ?? 'http://localhost:3001';

    let userManagement: 'up' | 'down' = 'down';
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

    return {
      status: userManagement === 'up' ? 'ok' : 'degraded',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      upstream: { userManagement },
    };
  }
}
