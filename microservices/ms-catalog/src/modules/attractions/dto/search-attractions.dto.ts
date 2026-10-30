import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  resolveBoolean,
  resolveNumber,
  resolveTrimmedString,
  resolveUpperString,
} from '../../../common/dto/dto-utils.js';

export class SearchAttractionsDto {
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'q', 'text'),
  )
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ type: String, nullable: true, example: 'Quito' })
  query?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveNumber(value, obj, 'ciu_id'),
  )
  @IsOptional()
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({
    type: 'integer',
    nullable: true,
    minimum: 1,
    example: 1,
  })
  city_id?: number;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveNumber(value, obj, 'cat_id'),
  )
  @IsOptional()
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({
    type: 'integer',
    nullable: true,
    minimum: 1,
    example: 1,
  })
  category_id?: number;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'categoria_slug'),
  )
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ type: String, nullable: true, example: 'cultural' })
  category_slug?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveUpperString(value, obj, 'tipo'),
  )
  @IsOptional()
  @IsIn(['GUIDED_TOUR', 'ADMISSION', 'DAY_TRIP', 'TRANSPORT', 'PACKAGE'])
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    enum: ['GUIDED_TOUR', 'ADMISSION', 'DAY_TRIP', 'TRANSPORT', 'PACKAGE'],
    example: 'GUIDED_TOUR',
  })
  type?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveBoolean(value, obj, 'destacada'),
  )
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ type: Boolean, nullable: true, example: true })
  featured?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({
    type: 'integer',
    nullable: true,
    minimum: 1,
    default: 1,
    example: 1,
  })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @ApiPropertyOptional({
    type: 'integer',
    nullable: true,
    minimum: 1,
    maximum: 100,
    default: 10,
    example: 10,
  })
  limit: number = 10;
}
