import { NestFactory } from '@nestjs/core';
import { RbacModule } from './rbac.module';

async function bootstrap() {
  const app = await NestFactory.create(RbacModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
