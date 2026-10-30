import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
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

export class CreateInclusionDto {
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveUpperString(value, obj, 'tipo'),
  )
  @IsIn(['INCLUYE', 'NO_INCLUYE', 'RECOMENDACION'], {
    message: 'El tipo debe ser INCLUYE, NO_INCLUYE o RECOMENDACION',
  })
  @ApiProperty({
    type: String,
    enum: ['INCLUYE', 'NO_INCLUYE', 'RECOMENDACION'],
    example: 'INCLUYE',
  })
  type!: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'nombre'),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @ApiProperty({
    type: String,
    maxLength: 150,
    minLength: 1,
    example: 'Guía bilingüe',
  })
  name!: string;

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
    default: 0,
    example: 0,
  })
  order?: number = 0;
}
