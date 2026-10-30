import { ApiProperty } from '@nestjs/swagger';
import type { IdiomaEntity } from '../../../database/entities/idioma.entity.js';

export class LanguageResponseDto {
  @ApiProperty({ type: 'integer', example: 1, readOnly: true })
  id!: number;
  @ApiProperty({ type: String, example: 'es', readOnly: true })
  code!: string;
  @ApiProperty({ type: String, example: 'Español', readOnly: true })
  name!: string;
}

export function toLanguageResponseDto(
  entity: IdiomaEntity,
): LanguageResponseDto {
  return {
    id: entity.idi_id,
    code: entity.idi_codigo,
    name: entity.idi_nombre,
  };
}
