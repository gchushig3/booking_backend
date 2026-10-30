import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import SwaggerParser from '@apidevtools/swagger-parser';
import { readFile, writeFile } from 'node:fs/promises';
import { stringify, parseDocument } from 'yaml';
import assert from 'node:assert/strict';
import { format, resolveConfig } from 'prettier';
import { fileURLToPath } from 'node:url';
import {
  AuthController,
  JwksController,
} from '../dist/auth/auth.controller.js';
import { BookingConsumerController } from '../dist/auth/booking-consumer.controller.js';
import {
  UsersController,
  RolesController,
} from '../dist/users/users.controller.js';
import { HealthController } from '../dist/health/health.controller.js';
import { AuthService } from '../dist/auth/auth.service.js';
import { IdentityJwtService } from '../dist/auth/jwt.service.js';
import { UsersService } from '../dist/users/users.service.js';
import { BookingApiKeyGuard } from '@booking/infrastructure';
import { configureApplication } from '../dist/configure-application.js';
import { createOpenApiDocument } from '../dist/openapi/configure-openapi.js';
let app;
try {
  const module = await Test.createTestingModule({
    controllers: [
      AuthController,
      JwksController,
      BookingConsumerController,
      UsersController,
      RolesController,
      HealthController,
    ],
    providers: [
      AuthService,
      IdentityJwtService,
      UsersService,
      DataSource,
      BookingApiKeyGuard,
    ].map((provide) => ({ provide, useValue: {} })),
  })
    .overrideGuard(BookingApiKeyGuard)
    .useValue({ canActivate: () => true })
    .compile();
  app = module.createNestApplication({ logger: false });
  configureApplication(app);
  const document = JSON.parse(JSON.stringify(createOpenApiDocument(app)));
  await SwaggerParser.validate(structuredClone(document), {
    resolve: { external: false },
  });
  const json = new URL('../docs/openapi.json', import.meta.url);
  const yaml = new URL('../docs/openapi.yaml', import.meta.url);
  if (process.argv.includes('--check')) {
    assert.deepEqual(JSON.parse(await readFile(json, 'utf8')), document);
    const parsed = parseDocument(await readFile(yaml, 'utf8'), {
      uniqueKeys: true,
    });
    assert.equal(parsed.errors.length, 0);
    assert.deepEqual(parsed.toJS(), document);
    console.log(
      'OpenAPI JSON/YAML validated and synchronized with real controller metadata.',
    );
  } else {
    const formatting = (await resolveConfig(fileURLToPath(json))) ?? {};
    await writeFile(
      json,
      await format(JSON.stringify(document), { ...formatting, parser: 'json' }),
    );
    await writeFile(
      yaml,
      await format(stringify(document, { lineWidth: 0 }), {
        ...formatting,
        parser: 'yaml',
      }),
    );
    console.log(
      'OpenAPI 3 JSON/YAML exported and validated; no credentials or user data included.',
    );
  }
} catch (error) {
  console.error(error.message);
  console.error(
    'OpenAPI export/check failed. Check compiled controller metadata. No external connections are opened.',
  );
  process.exitCode = 1;
} finally {
  if (app) await app.close();
}
