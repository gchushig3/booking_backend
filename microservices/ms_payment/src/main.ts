import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApplication } from './configure-application.js';
import { ConfigService } from '@nestjs/config';
import { sagaRmqOptions } from '@booking/infrastructure';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApplication(app);
  app.enableShutdownHooks();
  app.connectMicroservice(sagaRmqOptions(app.get(ConfigService), 'ms_payment'));
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
await bootstrap();
