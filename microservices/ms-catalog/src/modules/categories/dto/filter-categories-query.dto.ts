import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import {
  resolveBoolean,
  resolveNumber,
} from '../../../common/dto/dto-utils.js';

export class FilterCategoriesQueryDto {
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveNumber(value, obj, 'padre_id'),
  )
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({
    type: 'integer',
    nullable: true,
    minimum: 1,
    example: 1,
  })
  parent_id?: number;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveBoolean(value, obj, 'activa'),
  )
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    type: Boolean,
    nullable: true,
    example: true,
    description:
      'La consulta pública fuerza true incluso si se solicita false.',
  })
  active?: boolean;
}
