import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { resolveTrimmedString } from '../../../common/dto/dto-utils.js';

export class UpdateLanguageDto {
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'nombre'),
  )
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 50,
    minLength: 1,
    example: 'Español',
  })
  name?: string;
}
