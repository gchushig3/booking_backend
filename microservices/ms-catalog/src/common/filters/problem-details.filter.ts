import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { RequestWithCorrelationId } from '../middleware/correlation-id.middleware.js';

interface ProblemDetailsResponse {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  correlation_id: string;
  timestamp: string;
  errors?: unknown;
}

interface CustomErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
  code?: string;
  detail?: string;
  title?: string;
  errors?: unknown;
}

interface PostgresLikeError {
  code?: string;
  detail?: string;
  table?: string;
  constraint?: string;
  message?: string;
}

const HTTP_TITLES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
};

const DEFAULT_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & RequestWithCorrelationId>();

    const correlationId =
      request.correlationId ??
      (typeof request.headers['x-correlation-id'] === 'string'
        ? request.headers['x-correlation-id']
        : 'unknown');

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'Ha ocurrido un error interno en el servidor.';
    let code = 'INTERNAL_SERVER_ERROR';
    let validationErrors: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      title = HTTP_TITLES[status] ?? 'Error';
      code = DEFAULT_CODES[status] ?? 'ERROR';

      const resBody = exception.getResponse();
      if (typeof resBody === 'string') {
        detail = resBody;
      } else if (typeof resBody === 'object' && resBody !== null) {
        const body = resBody as CustomErrorBody;
        if (body.errors) validationErrors = body.errors;
        if (body.title) title = body.title;
        if (body.code) code = body.code;

        if (Array.isArray(body.message)) {
          detail = body.message.join('; ');
          validationErrors = body.message;
          code = body.code ?? 'VALIDATION_ERROR';
        } else if (typeof body.message === 'string') {
          detail = body.message;
        } else if (body.detail) {
          detail = body.detail;
        }
      }
    } else if (this.isPostgresError(exception)) {
      const pgErr = exception as PostgresLikeError;
      switch (pgErr.code) {
        case '23505': // unique_violation
          status = HttpStatus.CONFLICT;
          title = 'Conflict';
          code = 'CONFLICT';
          detail =
            'El recurso no se puede crear o actualizar debido a un conflicto de unicidad con datos existentes.';
          break;
        case '23503': // foreign_key_violation
          status = HttpStatus.CONFLICT;
          title = 'Conflict';
          code = 'FOREIGN_KEY_CONFLICT';
          detail =
            'No se puede completar la operación debido a una referencia de clave foránea en conflicto o inexistente.';
          break;
        case '23514': // check_violation
          status = HttpStatus.BAD_REQUEST;
          title = 'Bad Request';
          code = 'CHECK_VIOLATION';
          detail =
            'Los datos enviados infringen una regla de validación de base de datos.';
          break;
        default:
          this.logger.error(
            `Unhandled PostgreSQL error code [${pgErr.code}], correlation_id=${correlationId}`,
          );
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          title = 'Internal Server Error';
          code = 'DATABASE_ERROR';
          detail = 'Error en el procesamiento de la base de datos.';
          break;
      }
    } else {
      this.logger.error({
        code: 'INTERNAL_SERVER_ERROR',
        correlation_id: correlationId,
      });
    }

    const payload: ProblemDetailsResponse = {
      type: 'about:blank',
      title,
      status,
      detail,
      instance: request.originalUrl ?? request.url ?? '',
      code,
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
    };

    if (validationErrors) {
      payload.errors = validationErrors;
    }

    response.setHeader('Content-Type', 'application/problem+json');
    response.setHeader('X-Correlation-Id', correlationId);
    response.status(status).json(payload);
  }

  private isPostgresError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const candidate = error as PostgresLikeError;
    return typeof candidate.code === 'string' && candidate.code.length === 5;
  }
}
