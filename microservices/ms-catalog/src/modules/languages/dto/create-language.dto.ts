import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';
import {
  resolveLowerString,
  resolveTrimmedString,
} from '../../../common/dto/dto-utils.js';

export class CreateLanguageDto {
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveLowerString(value, obj, 'codigo'),
  )
  @IsString()
  @Length(2, 2, {
    message:
      'El código de idioma debe ser exactamente de 2 caracteres ISO 639-1',
  })
  @ApiProperty({ type: String, minLength: 2, maxLength: 2, example: 'es' })
  code!: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'nombre'),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @ApiProperty({
    type: String,
    maxLength: 50,
    minLength: 1,
    example: 'Español',
  })
  name!: string;
}
