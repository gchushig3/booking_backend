import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

import { isBigIntId } from '../validation/bigint-id.validation.js';

@Injectable()
export class BigIntIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (!isBigIntId(value)) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'INVALID_ID',
        message: 'id must be a positive BIGINT string',
      });
    }

    return value;
  }
}
