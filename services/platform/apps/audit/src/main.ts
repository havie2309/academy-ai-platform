import { NestFactory } from '@nestjs/core';
import { AuditModule } from './audit.module';

async function bootstrap() {
  const app = await NestFactory.create(AuditModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
