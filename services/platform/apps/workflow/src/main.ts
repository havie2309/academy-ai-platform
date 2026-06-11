import { NestFactory } from '@nestjs/core';
import { WorkflowModule } from './workflow.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkflowModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
