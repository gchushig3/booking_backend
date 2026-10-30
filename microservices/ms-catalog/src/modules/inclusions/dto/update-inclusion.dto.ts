import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  resolveNumber,
  resolveTrimmedString,
  resolveUpperString,
} from '../../../common/dto/dto-utils.js';

export class UpdateInclusionDto {
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveUpperString(value, obj, 'tipo'),
  )
  @IsOptional()
  @IsIn(['INCLUYE', 'NO_INCLUYE', 'RECOMENDACION'], {
    message: 'El tipo debe ser INCLUYE, NO_INCLUYE o RECOMENDACION',
  })
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    enum: ['INCLUYE', 'NO_INCLUYE', 'RECOMENDACION'],
    example: 'INCLUYE',
  })
  type?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'nombre'),
  )
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 150,
    example: 'Guía bilingüe',
  })
  name?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveNumber(value, obj, 'orden'),
  )
  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({
    type: 'integer',
    nullable: true,
    minimum: 0,
    example: 0,
  })
  order?: number;
}
