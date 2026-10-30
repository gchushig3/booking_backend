import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import type { Request, Response } from 'express';
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);
  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const errorCode =
      error && typeof error === 'object' && 'code' in error
        ? error.code
        : undefined;
    const unavailable =
      typeof errorCode === 'string' &&
      [
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        '57P01',
        '57P02',
        '57P03',
        '53300',
      ].includes(errorCode);
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : unavailable
          ? 503
          : 500;
    if (status === 401) res.setHeader('WWW-Authenticate', 'Bearer');
    const correlation = String(res.getHeader('X-Correlation-Id') ?? 'unknown');
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
    let detail =
      status >= 500
        ? 'Service unavailable or internal error.'
        : 'Request rejected.';
    let errors: unknown;
    if (error instanceof HttpException && status < 500) {
      const body: unknown = error.getResponse();
      if (typeof body === 'string') detail = body;
      else if (body && typeof body === 'object' && 'message' in body) {
        if ('errors' in body) errors = body.errors;
        const message: unknown = body.message;
        if (typeof message === 'string') detail = message;
        if (
          Array.isArray(message) &&
          message.every((item: unknown) => typeof item === 'string')
        ) {
          errors = message;
          detail = (message as string[]).join('; ');
        }
      }
    }
    if (status >= 500)
      this.logger.error({ code: 'SERVICE_ERROR', correlation_id: correlation });
    res
      .status(status)
      .type('application/problem+json')
      .json({
        type: 'about:blank',
        title: titles[status] ?? 'Error',
        status,
        detail,
        instance: req.originalUrl,
        code:
          status === HttpStatus.SERVICE_UNAVAILABLE
            ? 'SERVICE_UNAVAILABLE'
            : errors
              ? 'VALIDATION_ERROR'
              : (titles[status] ?? 'ERROR').toUpperCase().replaceAll(' ', '_'),
        correlation_id: correlation,
        timestamp: new Date().toISOString(),
        ...(errors ? { errors } : {}),
      });
  }
}
