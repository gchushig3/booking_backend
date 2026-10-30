import {
  ArgumentsHost,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ApiExceptionFilter } from './api-exception.filter.js';

describe('ApiExceptionFilter', () => {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;

  beforeEach(() => vi.clearAllMocks());

  it.each([
    new BadRequestException('untrusted value'),
    new NotFoundException('missing'),
  ])('normalizes framework errors to the OpenAPI Error shape', (error) => {
    new ApiExceptionFilter().catch(error, host);
    expect(json).toHaveBeenCalledWith({
      statusCode: error.getStatus(),
      code: error.getStatus() === 400 ? 'INVALID_REQUEST' : 'NOT_FOUND',
      message: 'Request could not be processed',
    });
  });

  it('preserves structured business errors', () => {
    const body = {
      statusCode: 400,
      code: 'INVALID_ID',
      message: 'Invalid identifier',
    };
    new ApiExceptionFilter().catch(new BadRequestException(body), host);
    expect(json).toHaveBeenCalledWith(body);
  });

  it('does not expose PostgreSQL query, parameter, or driver details', () => {
    new ApiExceptionFilter().catch(
      new QueryFailedError(
        'INSERT sensitive_sql',
        ['sensitive_parameter'],
        Object.assign(new Error(), {
          code: '23514',
          detail: 'sensitive_driver_detail',
        }),
      ),
      host,
    );
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
  });
});
