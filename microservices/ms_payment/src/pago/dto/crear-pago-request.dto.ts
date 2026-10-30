import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { IsBigIntId } from '../../common/validation/bigint-id.validation.js';
const POSITIVE_NUMERIC_12_2_PATTERN =
  /^(?:0\.(?:0[1-9]|[1-9][0-9])|[1-9][0-9]{0,9}\.[0-9]{2})$/;

export class CrearPagoRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  numero!: string;

  @IsString()
  @IsBigIntId()
  orden_id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  metodo_codigo!: string;

  @IsString()
  @Matches(POSITIVE_NUMERIC_12_2_PATTERN)
  monto!: string;
}
