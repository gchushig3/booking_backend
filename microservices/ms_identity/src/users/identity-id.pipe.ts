import { BadRequestException, Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
@Injectable()
export class IdentityIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n)
      throw new BadRequestException('Invalid user ID.');
    return value;
  }
}
@Injectable()
export class RoleIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (!/^[1-9]\d{0,4}$/.test(value) || Number(value) > 32767)
      throw new BadRequestException('Invalid role ID.');
    return Number(value);
  }
}
