import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AtraccionEntity } from '../../../database/entities/atraccion.entity.js';
import { toPhotoResponseDto, PhotoResponseDto } from './photo.dto.js';

export class AttractionOperatorSummary {
  @ApiProperty({ type: String, example: '1', readOnly: true })
  id!: string;
  @ApiProperty({ type: 'integer', example: 1, readOnly: true })
  code!: number;
  @ApiProperty({
    type: String,
    example: 'Recorrido cultural de Quito',
    readOnly: true,
  })
  name!: string;
}

export class AttractionCategorySummary {
  @ApiProperty({ type: 'integer', example: 1, readOnly: true })
  id!: number;
  @ApiProperty({ type: String, example: 'Cultural', readOnly: true })
  name!: string;
  @ApiProperty({
    type: String,
    example: 'recorrido-cultural-quito',
    readOnly: true,
  })
  slug!: string;
  @ApiProperty({ type: String, example: 'map-pin', readOnly: true })
  icon!: string;
}

export class AttractionLanguageSummary {
  @ApiProperty({ type: 'integer', example: 1, readOnly: true })
  id!: number;
  @ApiProperty({ type: String, example: 'es', readOnly: true })
  code!: string;
  @ApiProperty({ type: String, example: 'Español', readOnly: true })
  name!: string;
}

export class AttractionInclusionSummary {
  @ApiProperty({ type: 'integer', example: 1, readOnly: true })
  id!: number;
  @ApiProperty({ type: String, example: 'INCLUYE', readOnly: true })
  type!: string;
  @ApiProperty({ type: String, example: 'Guía bilingüe', readOnly: true })
  name!: string;
}

export class AttractionResponseDto {
  @ApiProperty({ type: String, example: '1', readOnly: true })
  id!: string;
  @ApiProperty({
    type: String,
    format: 'uuid',
    example: 'e10cc53e-510d-4aab-9461-086f9c806db0',
    readOnly: true,
  })
  uuid!: string;
  @ApiProperty({
    type: String,
    example: 'Recorrido cultural de Quito',
    readOnly: true,
  })
  name!: string;
  @ApiProperty({
    type: String,
    example: 'recorrido-cultural-quito',
    readOnly: true,
  })
  slug!: string;
  @ApiProperty({
    type: String,
    example: 'Recorrido guiado por el centro histórico de Quito.',
    readOnly: true,
  })
  description!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Conoce el centro histórico de Quito.',
    readOnly: true,
  })
  short_description!: string | null;
  @ApiProperty({ type: String, example: 'GUIDED_TOUR', readOnly: true })
  type!: string;
  @ApiProperty({ type: String, example: 'PUBLICADA', readOnly: true })
  status!: string;
  @ApiProperty({ type: Number, example: -0.2202, readOnly: true })
  latitude!: number;
  @ApiProperty({ type: Number, example: -78.5123, readOnly: true })
  longitude!: number;
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Centro histórico, Quito',
    readOnly: true,
  })
  address!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Plaza Grande, Quito',
    readOnly: true,
  })
  meeting_point!: string | null;
  @ApiProperty({ type: Number, example: 2, readOnly: true })
  duration_hours!: number;
  @ApiProperty({ type: String, example: 'USD', readOnly: true })
  currency!: string;
  @ApiProperty({ type: 'integer', example: 1, readOnly: true })
  city_id!: number;
  @ApiProperty({ type: String, example: '1', readOnly: true })
  operator_id!: string;
  @ApiProperty({ type: Boolean, example: true, readOnly: true })
  free_cancellation!: boolean;
  @ApiProperty({ type: 'integer', example: 1, readOnly: true })
  cancellation_hours!: number;
  @ApiProperty({ type: Boolean, example: true, readOnly: true })
  featured!: boolean;
  @ApiProperty({ type: Number, example: 0, readOnly: true })
  average_rating!: number;
  @ApiProperty({ type: 'integer', example: 0, readOnly: true })
  reviews_count!: number;
  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-10-28T12:00:00.000Z',
    readOnly: true,
  })
  created_at!: string;
  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-10-28T12:00:00.000Z',
    readOnly: true,
  })
  updated_at!: string;
  @ApiPropertyOptional({
    type: () => AttractionOperatorSummary,
    readOnly: true,
  })
  operator?: AttractionOperatorSummary;
  @ApiPropertyOptional({
    type: () => AttractionCategorySummary,
    isArray: true,
    readOnly: true,
  })
  categories?: AttractionCategorySummary[];
  @ApiPropertyOptional({
    type: () => AttractionLanguageSummary,
    isArray: true,
    readOnly: true,
  })
  languages?: AttractionLanguageSummary[];
  @ApiPropertyOptional({
    type: () => AttractionInclusionSummary,
    isArray: true,
    readOnly: true,
  })
  inclusions?: AttractionInclusionSummary[];
  @ApiPropertyOptional({
    type: () => PhotoResponseDto,
    isArray: true,
    readOnly: true,
  })
  photos?: PhotoResponseDto[];
}

export function toAttractionResponseDto(
  entity: AtraccionEntity,
): AttractionResponseDto {
  const photos = entity.fotos
    ? [...entity.fotos]
        .sort((a, b) => a.fot_orden - b.fot_orden)
        .map(toPhotoResponseDto)
    : undefined;

  const categories = entity.categorias
    ?.filter((ac) => ac.categoria)
    .map((ac) => ({
      id: ac.categoria.cat_id,
      name: ac.categoria.cat_nombre,
      slug: ac.categoria.cat_slug,
      icon: ac.categoria.cat_icono,
    }));

  const languages = entity.idiomas
    ?.filter((ai) => ai.idioma)
    .map((ai) => ({
      id: ai.idioma.idi_id,
      code: ai.idioma.idi_codigo,
      name: ai.idioma.idi_nombre,
    }));

  const inclusions = entity.inclusiones
    ?.filter((ai) => ai.inclusion)
    .map((ai) => ({
      id: ai.inclusion.inc_id,
      type: ai.inclusion.inc_tipo,
      name: ai.inclusion.inc_nombre,
    }));

  const operator = entity.operador
    ? {
        id: entity.operador.ope_id,
        code: entity.operador.ope_codigo,
        name: entity.operador.ope_nombre,
      }
    : undefined;

  return {
    id: entity.atr_id,
    uuid: entity.atr_uuid,
    name: entity.atr_nombre,
    slug: entity.atr_slug,
    description: entity.atr_descripcion,
    short_description: entity.atr_descripcion_corta,
    type: entity.atr_tipo,
    status: entity.atr_estado,
    latitude: Number(entity.atr_latitud),
    longitude: Number(entity.atr_longitud),
    address: entity.atr_direccion,
    meeting_point: entity.atr_punto_encuentro,
    duration_hours: Number(entity.atr_duracion_horas),
    currency: entity.atr_moneda,
    city_id: entity.ciu_id,
    operator_id: entity.ope_id,
    free_cancellation: entity.atr_cancelacion_gratuita,
    cancellation_hours: entity.atr_horas_cancelacion,
    featured: entity.atr_destacada,
    average_rating: Number(entity.atr_calificacion_promedio ?? 0),
    reviews_count: entity.atr_numero_resenas ?? 0,
    created_at:
      entity.atr_creado_en?.toISOString?.() ?? String(entity.atr_creado_en),
    updated_at:
      entity.atr_actualizado_en?.toISOString?.() ??
      String(entity.atr_actualizado_en),
    operator,
    categories,
    languages,
    inclusions,
    photos,
  };
}
