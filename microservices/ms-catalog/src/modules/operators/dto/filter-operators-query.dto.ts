import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/pagination/pagination-query.dto.js';
import {
  resolveBoolean,
  resolveNumber,
  resolveTrimmedString,
} from '../../../common/dto/dto-utils.js';

export class FilterOperatorsQueryDto extends PaginationQueryDto {
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveBoolean(value, obj, 'activo'),
  )
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ type: Boolean, nullable: true, example: true })
  active?: boolean;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveNumber(value, obj, 'prov_id'),
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
  province_id?: number;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'q'),
  )
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ type: String, nullable: true, example: 'Quito' })
  search?: string;
}
