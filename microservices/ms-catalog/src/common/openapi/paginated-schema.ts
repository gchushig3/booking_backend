import type { Type } from '@nestjs/common';
import { getSchemaPath } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';

export function paginatedSchema(model: Type<unknown>): SchemaObject {
  return {
    type: 'object',
    required: ['items', 'total', 'page', 'limit', 'total_pages'],
    properties: {
      items: { type: 'array', items: { $ref: getSchemaPath(model) } },
      total: { type: 'integer', minimum: 0, example: 0 },
      page: { type: 'integer', minimum: 1, example: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, example: 10 },
      total_pages: { type: 'integer', minimum: 1, example: 1 },
    },
  };
}
