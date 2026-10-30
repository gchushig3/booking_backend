import { ApiProperty } from '@nestjs/swagger';
import type { CategoriaEntity } from '../../../database/entities/categoria.entity.js';

export class CategoryResponseDto {
  @ApiProperty({ type: 'integer', example: 1, readOnly: true })
  id!: number;
  @ApiProperty({ type: 'integer', nullable: true, example: 1, readOnly: true })
  parent_id!: number | null;
  @ApiProperty({ type: String, example: 'Cultural', readOnly: true })
  name!: string;
  @ApiProperty({
    type: String,
    example: 'recorrido-cultural-quito',
    readOnly: true,
  })
  slug!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Recorrido guiado por el centro histórico de Quito.',
    readOnly: true,
  })
  description!: string | null;
  @ApiProperty({ type: String, example: 'map-pin', readOnly: true })
  icon!: string;
  @ApiProperty({ type: 'integer', example: 0, readOnly: true })
  order!: number;
  @ApiProperty({ type: Boolean, example: true, readOnly: true })
  active!: boolean;
}

export class CategoryTreeNodeDto extends CategoryResponseDto {
  @ApiProperty({
    type: () => CategoryTreeNodeDto,
    isArray: true,
    readOnly: true,
  })
  children!: CategoryTreeNodeDto[];
}

export function toCategoryResponseDto(
  entity: CategoriaEntity,
): CategoryResponseDto {
  return {
    id: entity.cat_id,
    parent_id: entity.cat_padre_id,
    name: entity.cat_nombre,
    slug: entity.cat_slug,
    description: entity.cat_descripcion,
    icon: entity.cat_icono,
    order: entity.cat_orden,
    active: entity.cat_activa,
  };
}
