import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v2');
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3016), '0.0.0.0');
}
await bootstrap();
