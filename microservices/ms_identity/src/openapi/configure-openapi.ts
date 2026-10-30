import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Descubre EC — Identity & Access Service')
    .setDescription(
      'API interna de Identity. Registro/login públicos; usar access_token en Authorize para operaciones protegidas. ADMIN inicial mediante CLI local, nunca registro público. Roles vigentes en PostgreSQL. Mailpit local permite completar verificación y recuperación. Todos los errores utilizan application/problem+json; BIGINT se serializa como string.',
    )
    .setVersion('2.0.0')
    .addServer('/')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      'booking-api-key',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Pegar solo access_token obtenido por POST /api/v2/auth/login; no usar refresh_token.',
      },
      'bearer',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controller, method) => `${controller}_${method}`,
  });
  for (const schema of Object.values(document.components?.schemas ?? {}))
    if (!('$ref' in schema) && schema.type === 'object')
      schema.additionalProperties = false;
  const profile = document.components?.schemas?.ProfileDto;
  if (profile && !('$ref' in profile)) profile.minProperties = 1;
  return document;
}
export function configureOpenApi(app: INestApplication) {
  const document = createOpenApiDocument(app);
  SwaggerModule.setup('api/docs', app, document, {
    useGlobalPrefix: false,
    jsonDocumentUrl: 'api/docs-json',
    yamlDocumentUrl: 'api/docs-yaml',
    swaggerOptions: {
      persistAuthorization: false,
      validatorUrl: null,
      displayRequestDuration: true,
    },
    customSiteTitle: 'Descubre EC — Identity API',
  });
  return document;
}
