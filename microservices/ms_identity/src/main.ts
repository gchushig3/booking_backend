import 'reflect-metadata';
import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApplication } from './configure-application.js';
import type { IdentityEnvironment } from './config/environment.js';
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: true, colors: false }),
  });
  const env = app
    .get(ConfigService)
    .getOrThrow<IdentityEnvironment>('identity');
  configureApplication(app, env.CORS_ORIGINS);
  await app.listen(env.PORT, '0.0.0.0');
}
void bootstrap().catch((error: unknown) => {
  // Solo el mensaje: los errores de configuración no incluyen valores secretos.
  const reason = error instanceof Error ? error.message : 'unknown error';
  process.stderr.write(
    `ms-identity: startup failed: ${reason.slice(0, 300)}\n`,
  );
  process.exitCode = 1;
});
