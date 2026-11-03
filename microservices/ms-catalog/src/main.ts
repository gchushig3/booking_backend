import 'reflect-metadata';
import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { configureOpenApi } from './common/openapi/configure-openapi.js';
import { AppModule } from './app.module.js';
import { rabbitMqOptions } from '@booking/infrastructure';
import { configureApplication } from './configure-application.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: true, colors: false }),
  });
  configureApplication(app);

  configureOpenApi(app);

  const config = app.get(ConfigService);
  const corsOrigins = (
    config.get<string>('CORS_ORIGINS') ?? 'http://localhost:4200'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.connectMicroservice(
    rabbitMqOptions(
      config,
      config.get<string>('AMQP_CATALOG_QUEUE') ?? 'catalog.reviews',
    ),
  );
  await app.startAllMicroservices();
  await app.listen(config.getOrThrow<number>('catalog.PORT'), '0.0.0.0');
}

void bootstrap().catch(() => {
  // Los detalles de conexión y credenciales nunca se imprimen aquí.
  process.stderr.write(
    'ms-catalog: no fue posible iniciar; revise la configuración y PostgreSQL.\n',
  );
  process.exitCode = 1;
});
