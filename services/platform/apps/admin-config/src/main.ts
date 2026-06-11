import { NestFactory } from '@nestjs/core';
import { AdminConfigModule } from './admin-config.module';

async function bootstrap() {
  const app = await NestFactory.create(AdminConfigModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
