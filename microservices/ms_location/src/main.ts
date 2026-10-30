import { NestFactory } from '@nestjs/core';
import type { AnySchema } from 'ajv';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { SchemaFirstValidationPipe } from '@booking/infrastructure';
import { AppModule } from './app.module.js';
import { CreateCiudadDto } from './ciudad/dto/create-ciudad.dto.js';
import { UpdateCiudadDto } from './ciudad/dto/update-ciudad.dto.js';
import { CreateProvinciaDto } from './provincia/dto/create-provincia.dto.js';
import { UpdateProvinciaDto } from './provincia/dto/update-provincia.dto.js';
import { CreateRegionDto } from './region/dto/create-region.dto.js';
import { UpdateRegionDto } from './region/dto/update-region.dto.js';
import {
  createCiudadSchema,
  createProvinciaSchema,
  createRegionSchema,
  updateCiudadSchema,
  updateProvinciaSchema,
  updateRegionSchema,
} from './location.schemas.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new SchemaFirstValidationPipe(
      new Map<Function, AnySchema>([
        [CreateCiudadDto, createCiudadSchema],
        [UpdateCiudadDto, updateCiudadSchema],
        [CreateProvinciaDto, createProvinciaSchema],
        [UpdateProvinciaDto, updateProvinciaSchema],
        [CreateRegionDto, createRegionSchema],
        [UpdateRegionDto, updateRegionSchema],
      ]),
    ),
  );
  app.setGlobalPrefix('api/v2');
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('MS Location API')
    .setDescription(
      'Microservicio de geografia: regiones, provincias y ciudades',
    )
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ? Number(process.env.PORT) : 3019;
  await app.listen(port, '0.0.0.0');
}
await bootstrap();
