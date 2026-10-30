import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { sagaRmqOptions } from '@booking/infrastructure';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v2');
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  app.connectMicroservice(sagaRmqOptions(config, 'ms_refund'));
  await app.startAllMicroservices();
  await app.listen(Number(config.get('PORT') ?? 3015), '0.0.0.0');
}
await bootstrap();
