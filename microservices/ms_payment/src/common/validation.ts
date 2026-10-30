import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

export function createRequestValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    exceptionFactory: (errors: ValidationError[]) =>
      new BadRequestException({
        statusCode: 400,
        code: 'INVALID_REQUEST',
        message: 'Request validation failed',
        details: {
          fields: errors.map((error) => ({
            field: error.property,
            constraints: Object.keys(error.constraints ?? {}),
          })),
        },
      }),
  });
}
