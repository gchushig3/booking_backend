import type { INestApplication } from '@nestjs/common';
import { SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { parseDocument } from 'yaml';
import { createRequestValidationPipe } from './common/validation.js';
import { paymentSchemaPipe } from './saga/payment.schemas.js';

/** Canonical API-first file, also required alongside dist for start:prod. */
export function loadPaymentOpenApi(): OpenAPIObject {
  const source = readFileSync(
    new URL('../contract/ms_payment-openapi-v2.yaml', import.meta.url),
    'utf8',
  );
  const yaml = parseDocument(source, { uniqueKeys: true });
  if (yaml.errors.length > 0)
    throw new Error('Invalid canonical Payment OpenAPI YAML');
  const document: unknown = yaml.toJS();
  if (
    typeof document !== 'object' ||
    document === null ||
    !('openapi' in document) ||
    document.openapi !== '3.0.3' ||
    !('info' in document) ||
    typeof document.info !== 'object' ||
    document.info === null ||
    !('version' in document.info) ||
    document.info.version !== '2.0.0' ||
    !('paths' in document) ||
    typeof document.paths !== 'object' ||
    document.paths === null
  )
    throw new Error('Expected the canonical Payment REST v2 OpenAPI document');
  // Trusted local API-first document; full refs/routes/schema equivalence is covered by HTTP tests.
  return document as OpenAPIObject;
}

/** Shared by bootstrap and real Nest HTTP suites so setup cannot silently drift. */
export function configureApplication(app: INestApplication): void {
  app.setGlobalPrefix('api/v2');
  app.useGlobalPipes(paymentSchemaPipe, createRequestValidationPipe());
  SwaggerModule.setup('api/docs', app, loadPaymentOpenApi(), {
    useGlobalPrefix: false,
    jsonDocumentUrl: 'api/docs/openapi.json',
    raw: ['json'],
    customSiteTitle: 'Payment REST v2 - simulacion local sin autenticacion',
    swaggerOptions: { persistAuthorization: false, validatorUrl: null },
  });
}
