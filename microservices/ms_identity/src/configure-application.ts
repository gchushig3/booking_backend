import { randomUUID } from 'node:crypto';
import { SchemaFirstValidationPipe } from '@booking/infrastructure';
import { authSchemas } from './auth/auth.schemas.js';
import type { INestApplication } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { ProblemDetailsFilter } from './common/problem-details.filter.js';
import type { IdentityEnvironment } from './config/environment.js';
import { configureOpenApi } from './openapi/configure-openapi.js';
export function configureApplication(
  app: INestApplication,
  origins: IdentityEnvironment['CORS_ORIGINS'] = [],
): void {
  app.setGlobalPrefix('api/v2');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header('X-Correlation-Id')?.trim();
    res.setHeader('X-Correlation-Id', incoming || randomUUID());
    if (
      ['/api/v2/auth', '/api/v2/users', '/api/v2/roles'].some((path) =>
        req.path.startsWith(path),
      )
    )
      res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.useGlobalPipes(new SchemaFirstValidationPipe(authSchemas));
  app.enableCors({
    origin: origins.length ? origins : false,
    credentials: false,
  });
  app.enableShutdownHooks();
  configureOpenApi(app);
}
