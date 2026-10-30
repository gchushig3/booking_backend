import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const body =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    if (typeof body === 'object' && body !== null && 'code' in body) {
      response.status(status).json(body);
      return;
    }
    const codes: Record<number, string> = {
      400: 'INVALID_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'PAYMENT_CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
    };
    // Never reflect driver errors, SQL parameters, or untrusted request values.
    response.status(status).json({
      statusCode: status,
      code: codes[status] ?? 'INTERNAL_SERVER_ERROR',
      message:
        status >= 500
          ? 'Internal server error'
          : 'Request could not be processed',
    });
  }
}
