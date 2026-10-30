import { Reflector } from '@nestjs/core';
import { AdministrativeAccessGuard } from './common/guards/administrative-access.guard.js';
import { ConfigService } from '@nestjs/config';
import { SchemaFirstValidationPipe } from '@booking/infrastructure';
import {
  createAttractionSchema,
  updateAttractionSchema,
} from './booking/booking.schemas.js';
import { CreateAttractionDto } from './modules/attractions/dto/create-attraction.dto.js';
import { UpdateAttractionDto } from './modules/attractions/dto/update-attraction.dto.js';
import type { INestApplication, Type } from '@nestjs/common';
import { correlationIdMiddleware } from './common/middleware/correlation-id.middleware.js';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter.js';

export function configureApplication(app: INestApplication): void {
  let config: ConfigService;
  try {
    config = app.get(ConfigService);
  } catch {
    config = new ConfigService();
  }
  app.useGlobalGuards(
    new AdministrativeAccessGuard(app.get(Reflector), config),
  );
  app.setGlobalPrefix('api/v2');
  // Booking consume /api/v3; se sirve con las mismas rutas de /api/v2.
  app.use((req: { url: string }, _res: unknown, next: () => void) => {
    if (req.url.startsWith('/api/v3/')) req.url = `/api/v2/${req.url.slice(8)}`;
    next();
  });
  app.use(correlationIdMiddleware);
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.useGlobalPipes(
    new SchemaFirstValidationPipe(
      new Map<Type<unknown>, object>([
        [CreateAttractionDto, createAttractionSchema],
        [UpdateAttractionDto, updateAttractionSchema],
      ]),
    ),
  );
  app.enableShutdownHooks();
}
