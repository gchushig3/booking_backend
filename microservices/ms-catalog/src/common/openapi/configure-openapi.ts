import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import type { ResponseObject, SchemaObject } from '@nestjs/swagger';
import type { ParameterObject } from '@nestjs/swagger';
import {
  bookingDefinitions,
  bookingListParameters,
} from '../../booking/contract-schemas.js';
import { profileSchema } from '../../booking/booking.schemas.js';

function openApiSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(openApiSchema);
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === '$defs') continue;
    result[key] =
      key === '$ref' && typeof entry === 'string'
        ? entry.replace('#/$defs/', '#/components/schemas/')
        : openApiSchema(entry);
  }
  if (Array.isArray(result.type) && result.type.includes('null')) {
    result.type = result.type.find((type) => type !== 'null');
    result.nullable = true;
  }
  return result;
}

const problemSchema: SchemaObject = {
  type: 'object',
  required: [
    'type',
    'title',
    'status',
    'detail',
    'instance',
    'code',
    'correlation_id',
    'timestamp',
  ],
  properties: {
    type: { type: 'string', example: 'about:blank' },
    title: { type: 'string', example: 'Unauthorized' },
    status: { type: 'integer', example: 401 },
    detail: { type: 'string' },
    instance: { type: 'string', example: '/api/v2/atracciones' },
    code: { type: 'string', example: 'UNAUTHORIZED' },
    correlation_id: { type: 'string', example: 'cid-example' },
    timestamp: { type: 'string', format: 'date-time' },
    errors: {
      type: 'array',
      items: { type: 'string' },
      description: 'Mensajes de validación, cuando aplica.',
    },
  },
};

const titles: Record<string, string> = {
  '400': 'Bad Request',
  '401': 'Unauthorized',
  '403': 'Forbidden',
  '404': 'Not Found',
  '409': 'Conflict',
  '500': 'Internal Server Error',
  '503': 'Service Unavailable',
};

function problemResponse(status: string, path: string): ResponseObject {
  return {
    description: titles[status] ?? 'Error',
    content: {
      'application/problem+json': {
        schema: { $ref: '#/components/schemas/ProblemDetails' },
        example: {
          type: 'about:blank',
          title: titles[status],
          status: Number(status),
          detail:
            status === '401'
              ? 'Credenciales de Identity invalidas o ausentes.'
              : status === '500'
                ? 'Ha ocurrido un error interno en el servidor.'
                : status === '404'
                  ? 'Atracción no encontrada o no disponible públicamente.'
                  : status === '400'
                    ? 'limit must not be greater than 100'
                    : titles[status],
          instance: path,
          code:
            status === '401'
              ? 'UNAUTHORIZED'
              : status === '400'
                ? 'VALIDATION_ERROR'
                : status === '500'
                  ? 'INTERNAL_SERVER_ERROR'
                  : status === '404' && path === '/api/v2/atracciones/{id}'
                    ? 'ATTRACTION_NOT_FOUND'
                    : titles[status]?.toUpperCase().replaceAll(' ', '_'),
          correlation_id: 'cid-example',
          timestamp: '2026-10-28T12:00:00.000Z',
        },
      },
    },
  };
}

/** Single source for runtime Swagger and the checked-in local contract. */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('ms_catalog — Catalog & Attractions Service')
    .setVersion('2.0.0')
    .setDescription(
      'API interna de Descubre EC bajo /api/v2. Las consultas públicas están disponibles. ' +
        'Administracion con JWT RS256 y sesion/rol ADMIN validados por Identity. ' +
        'Catalogo Booking con proyeccion local de ciudad/tarifas y consultas gRPC de aforo.',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Access JWT emitido por Identity; requiere sesion vigente y rol ADMIN.',
      },
      'jwt',
    )
    .addGlobalParameters({
      name: 'X-Correlation-Id',
      in: 'header',
      required: false,
      description:
        'Texto de correlación. Se recorta y propaga; si está ausente o vacío se genera un UUID.',
      schema: { type: 'string', example: 'cid-example' },
    })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas.ProblemDetails = problemSchema;
  for (const [name, schema] of Object.entries(bookingDefinitions)) {
    document.components.schemas[name] = openApiSchema(schema) as SchemaObject;
  }
  document.components.schemas.BookingProfile = openApiSchema(
    profileSchema,
  ) as SchemaObject;

  for (const [path, method, schema] of [
    ['/api/v2/atracciones', 'get', 'SearchAtraccionesResponseV2'],
    ['/api/v2/atracciones/search', 'post', 'SearchAtraccionesResponseV2'],
    ['/api/v2/atracciones/{id}', 'get', 'AtraccionDetailResponseV2'],
    ['/api/v2/atracciones/categorias', 'get', 'CategoryFlat'],
    ['/api/v2/atracciones/categorias/arbol', 'get', 'CategoryTreeNode'],
  ] as const) {
    const operation = document.paths[path]?.[method];
    if (!operation) continue;
    const ref = { $ref: `#/components/schemas/${schema}` };
    operation.responses['200'] = {
      description: 'Respuesta contractual Booking',
      content: {
        'application/json': {
          schema: schema.startsWith('Category')
            ? { type: 'array', items: ref }
            : ref,
        },
      },
    };
    if (method === 'post')
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SearchAtraccionesRequestV2' },
          },
        },
      };
    if (path === '/api/v2/atracciones')
      operation.parameters = [
        ...(bookingListParameters as ParameterObject[]),
        ...(operation.parameters ?? []).filter(
          (parameter) => 'in' in parameter && parameter.in === 'header',
        ),
      ];
    operation.responses['503'] = problemResponse('503', path);
  }
  const profileOperation =
    document.paths['/api/v2/atracciones/{id}/booking']?.put;
  if (profileOperation) {
    profileOperation.parameters ??= [];
    profileOperation.parameters.push({
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string' },
    });
    profileOperation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/BookingProfile' },
        },
      },
    };
    profileOperation.responses['200'] = {
      description: 'Proyeccion guardada',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/BookingProfile' },
        },
      },
    };
  }

  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const operation = item[method];
      if (!operation) continue;
      const authenticated =
        operation.security?.some((scheme) => 'jwt' in scheme) ?? false;
      if (authenticated) {
        operation.responses['401'] = problemResponse('401', path);
        operation.responses['403'] = problemResponse('403', path);
        operation.responses['503'] = problemResponse('503', path);
      } else {
        operation.security = [];
        // Validation errors can occur only where input is actually validated.
        if (
          operation.requestBody ||
          operation.parameters?.some((p) => 'in' in p && p.in === 'query')
        ) {
          operation.responses['400'] ??= problemResponse('400', path);
        }
        if (path !== '/api/v2/health/live')
          operation.responses['500'] ??= problemResponse('500', path);
      }
      for (const [status, response] of Object.entries(operation.responses)) {
        if (!response || '$ref' in response) continue;
        if (Number(status) >= 400) {
          operation.responses[status] = {
            ...problemResponse(status, path),
            description: response.description,
          };
        }
        const current = operation.responses[status] as ResponseObject;
        current.headers = {
          ...current.headers,
          'X-Correlation-Id': {
            description:
              'Identificador propagado o generado para esta solicitud.',
            schema: { type: 'string', example: 'cid-example' },
          },
        };
      }
    }
  }
  return document;
}

export function configureOpenApi(app: INestApplication): OpenAPIObject {
  const document = createOpenApiDocument(app);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'ms_catalog — API Docs',
    jsonDocumentUrl: 'api/docs-json',
    yamlDocumentUrl: 'api/docs-yaml',
    swaggerOptions: { persistAuthorization: false },
  });
  return document;
}
