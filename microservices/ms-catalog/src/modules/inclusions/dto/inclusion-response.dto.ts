import { ApiProperty } from '@nestjs/swagger';
import type { InclusionEntity } from '../../../database/entities/inclusion.entity.js';

export class InclusionResponseDto {
  @ApiProperty({ type: 'integer', example: 1, readOnly: true })
  id!: number;
  @ApiProperty({ type: String, example: 'INCLUYE', readOnly: true })
  type!: string;
  @ApiProperty({ type: String, example: 'Guía bilingüe', readOnly: true })
  name!: string;
  @ApiProperty({ type: 'integer', example: 0, readOnly: true })
  order!: number;
}

export function toInclusionResponseDto(
  entity: InclusionEntity,
): InclusionResponseDto {
  return {
    id: entity.inc_id,
    type: entity.inc_tipo,
    name: entity.inc_nombre,
    order: entity.inc_orden,
  };
}
