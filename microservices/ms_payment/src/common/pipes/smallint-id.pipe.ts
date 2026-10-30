import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class SmallIntIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (!/^[0-9]+$/.test(value)) {
      throw new BadRequestException('id must be a positive SMALLINT');
    }

    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1 || id > 32767) {
      throw new BadRequestException('id must be a positive SMALLINT');
    }

    return id;
  }
}
