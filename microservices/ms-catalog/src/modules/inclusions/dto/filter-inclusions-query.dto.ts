import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { resolveUpperString } from '../../../common/dto/dto-utils.js';

export class FilterInclusionsQueryDto {
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveUpperString(value, obj, 'tipo'),
  )
  @IsOptional()
  @IsIn(['INCLUYE', 'NO_INCLUYE', 'RECOMENDACION'])
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    enum: ['INCLUYE', 'NO_INCLUYE', 'RECOMENDACION'],
    example: 'INCLUYE',
  })
  type?: string;
}
