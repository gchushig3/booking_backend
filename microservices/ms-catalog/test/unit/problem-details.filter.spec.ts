import { describe, expect, it, jest } from '@jest/globals';
import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProblemDetailsFilter } from '../../src/common/filters/problem-details.filter.js';
import type { RequestWithCorrelationId } from '../../src/common/middleware/correlation-id.middleware.js';

describe('ProblemDetailsFilter', () => {
  const filter = new ProblemDetailsFilter();

  function createMockHost(
    reqOverrides: Partial<Request & RequestWithCorrelationId> = {},
  ): {
    host: ArgumentsHost;
    response: {
      status: jest.Mock;
      json: jest.Mock;
      setHeader: jest.Mock;
    };
  } {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };

    const request = {
      url: '/api/v2/test',
      originalUrl: '/api/v2/test',
      headers: {},
      correlationId: 'cid-test-123',
      ...reqOverrides,
    } as unknown as Request & RequestWithCorrelationId;

    const host = {
      switchToHttp: () => ({
        getResponse: () => response as unknown as Response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;

    return { host, response };
  }

  it('formatea un HttpException (404 Not Found) en application/problem+json', () => {
    const { host, response } = createMockHost();
    const exception = new NotFoundException('Recurso no encontrado');

    filter.catch(exception, host);

    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/problem+json',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Correlation-Id',
      'cid-test-123',
    );
    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Recurso no encontrado',
        instance: '/api/v2/test',
        code: 'NOT_FOUND',
        correlation_id: 'cid-test-123',
      }),
    );
  });

  it('formatea errores de validación de ValidationPipe (400 Bad Request)', () => {
    const { host, response } = createMockHost();
    const exception = new BadRequestException({
      statusCode: 400,
      message: ['El nombre es obligatorio', 'La duración debe ser positiva'],
      error: 'Bad Request',
    });

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'El nombre es obligatorio; La duración debe ser positiva',
        code: 'VALIDATION_ERROR',
        errors: ['El nombre es obligatorio', 'La duración debe ser positiva'],
      }),
    );
  });

  it('mapea un error de unicidad PostgreSQL (23505) a 409 Conflict', () => {
    const { host, response } = createMockHost();
    const pgError = {
      code: '23505',
      detail: 'Key (atr_slug)=(tour-quito) already exists.',
    };

    filter.catch(pgError, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        code: 'CONFLICT',
      }),
    );
  });

  it('mapea un error de clave foránea PostgreSQL (23503) a 409 Conflict', () => {
    const { host, response } = createMockHost();
    const pgError = {
      code: '23503',
      detail: 'Key (ope_id)=(999) is not present in table "operador".',
    };

    filter.catch(pgError, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 409,
        code: 'FOREIGN_KEY_CONFLICT',
      }),
    );
  });

  it('mapea un error de restricción CHECK PostgreSQL (23514) a 400 Bad Request', () => {
    const { host, response } = createMockHost();
    const pgError = {
      code: '23514',
      constraint: 'atraccion_duracion_valida',
    };

    filter.catch(pgError, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 400,
        code: 'CHECK_VIOLATION',
      }),
    );
  });

  it('no filtra stack traces ni consultas internas en errores no controlados (500)', () => {
    const { host, response } = createMockHost();
    const internalError = new Error('Database password was leaked: secret123');

    filter.catch(internalError, host);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Ha ocurrido un error interno en el servidor.',
        code: 'INTERNAL_SERVER_ERROR',
      }),
    );
  });
});
