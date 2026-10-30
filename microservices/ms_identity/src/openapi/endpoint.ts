import { applyDecorators } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ProblemResponse } from './responses.js';
interface EndpointOptions {
  summary: string;
  description?: string;
  access: 'public' | 'authenticated' | 'ADMIN';
  status?: number;
  type?: Type<unknown>;
  array?: boolean;
  errors?: number[];
  throttled?: boolean;
}
const titles: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};
export function ApiEndpoint(options: EndpointOptions) {
  const errors = new Set([
    500,
    503,
    ...(options.errors ?? []),
    ...(options.access === 'public' ? [] : [401, 403]),
    ...(options.throttled ? [429] : []),
  ]);
  const correlation = {
    description: 'Identificador de correlación propagado o generado.',
    schema: { type: 'string' as const },
    example: 'cid-identity-example',
  };
  return applyDecorators(
    ApiOperation({
      summary: options.summary,
      description: `${options.access === 'ADMIN' ? 'Requiere ADMIN activo. ' : options.access === 'authenticated' ? 'Requiere usuario, sesión y algún rol activos. ' : 'Público; no requiere access JWT. '}${options.description ?? ''}`,
      security: options.access === 'public' ? [] : [{ bearer: [] }],
    }),
    ApiHeader({
      name: 'X-Correlation-Id',
      required: false,
      description: 'Identificador opcional; se devuelve en la respuesta.',
      schema: { type: 'string' },
      example: 'cid-identity-example',
    }),
    ApiExtraModels(ProblemResponse, ...(options.type ? [options.type] : [])),
    ApiResponse({
      status: options.status ?? 200,
      description: 'Operación exitosa.',
      ...(options.type
        ? { type: options.type, isArray: options.array ?? false }
        : {}),
      headers: { 'X-Correlation-Id': correlation },
    }),
    ...[...errors].map((status) =>
      ApiResponse({
        status,
        description: titles[status] ?? 'Error',
        headers: {
          'X-Correlation-Id': correlation,
          ...(status === 401
            ? {
                'WWW-Authenticate': {
                  schema: { type: 'string' },
                  example: 'Bearer',
                },
              }
            : {}),
          ...(status === 429
            ? {
                'Retry-After': {
                  description: 'Segundos hasta poder reintentar.',
                  schema: { type: 'integer' },
                  example: 60,
                },
              }
            : {}),
        },
        content: {
          'application/problem+json': {
            schema: { $ref: getSchemaPath(ProblemResponse) },
            example: {
              type: 'about:blank',
              title: titles[status],
              status,
              detail:
                status >= 500
                  ? 'Service unavailable or internal error.'
                  : status === 401
                    ? 'Invalid or expired credentials.'
                    : 'Request rejected.',
              instance: '/api/v2/auth/me',
              code: (titles[status] ?? 'ERROR')
                .toUpperCase()
                .replaceAll(' ', '_'),
              correlation_id: 'cid-identity-example',
              timestamp: '2026-10-29T12:00:00.000Z',
            },
          },
        },
      }),
    ),
  );
}
export const ApiUserId = () =>
  ApiParam({
    name: 'id',
    schema: { type: 'string', pattern: '^[1-9][0-9]{0,18}$', maxLength: 19 },
    description:
      'ID BIGINT decimal, máximo 9223372036854775807. Mantener como string.',
    example: '1',
  });
export const ApiRoleId = () =>
  ApiParam({
    name: 'roleId',
    schema: { type: 'integer', minimum: 1, maximum: 32767 },
    description: 'ID SMALLINT del rol.',
    example: 2,
  });
