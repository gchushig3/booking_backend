import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { sagaRmqOptions } from '@booking/infrastructure';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v2');
  app.enableShutdownHooks();
  app.connectMicroservice(sagaRmqOptions(app.get(ConfigService), 'ms_cart'));
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
