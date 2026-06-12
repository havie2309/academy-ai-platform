import { Controller, Get, Post, Body } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'academy-ai-platform',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('chat')
  chat(@Body() body: { message: string; session_id?: string }) {
    return {
      answer: `Phản hồi mock cho: "${body.message}"\n\n_(Chưa kết nối LLM — Demo 2)_`,
      citations: [],
      session_id: body.session_id || `session_${Date.now()}`,
    };
  }
}