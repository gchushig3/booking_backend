import { HttpException, HttpStatus } from '@nestjs/common';

export class CatalogException extends HttpException {
  constructor(status: HttpStatus, title: string, detail: string, code: string) {
    super({ message: detail, title, detail, code, statusCode: status }, status);
  }

  static notFound(
    detail: string,
    code: string = 'NOT_FOUND',
  ): CatalogException {
    return new CatalogException(
      HttpStatus.NOT_FOUND,
      'Not Found',
      detail,
      code,
    );
  }

  static conflict(detail: string, code: string = 'CONFLICT'): CatalogException {
    return new CatalogException(HttpStatus.CONFLICT, 'Conflict', detail, code);
  }

  static badRequest(
    detail: string,
    code: string = 'BAD_REQUEST',
  ): CatalogException {
    return new CatalogException(
      HttpStatus.BAD_REQUEST,
      'Bad Request',
      detail,
      code,
    );
  }
}
