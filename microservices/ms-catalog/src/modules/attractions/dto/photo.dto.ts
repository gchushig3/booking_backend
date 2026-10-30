import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { AtraccionFotoEntity } from '../../../database/entities/atraccion-foto.entity.js';
import {
  resolveNumber,
  resolveTrimmedString,
} from '../../../common/dto/dto-utils.js';

export class CreatePhotoDto {
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'fot_url'),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @ApiProperty({
    type: String,
    maxLength: 500,
    minLength: 1,
    example: 'https://example.com/quito.jpg',
  })
  url!: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'fot_alt'),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @ApiProperty({
    type: String,
    maxLength: 200,
    minLength: 1,
    example: 'Vista del centro histórico de Quito',
  })
  alt!: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveNumber(value, obj, 'orden', 'fot_orden'),
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

export class UpdatePhotoDto {
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'fot_url'),
  )
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 500,
    example: 'https://example.com/quito.jpg',
  })
  url?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'fot_alt'),
  )
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 200,
    example: 'Vista del centro histórico de Quito',
  })
  alt?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveNumber(value, obj, 'orden', 'fot_orden'),
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

export class PhotoResponseDto {
  @ApiProperty({ type: String, example: '1', readOnly: true })
  id!: string;
  @ApiProperty({ type: String, example: '1', readOnly: true })
  attraction_id!: string;
  @ApiProperty({
    type: String,
    example: 'https://example.com/quito.jpg',
    readOnly: true,
  })
  url!: string;
  @ApiProperty({
    type: String,
    example: 'Vista del centro histórico de Quito',
    readOnly: true,
  })
  alt!: string;
  @ApiProperty({ type: 'integer', example: 0, readOnly: true })
  order!: number;
}

export function toPhotoResponseDto(
  entity: AtraccionFotoEntity,
): PhotoResponseDto {
  return {
    id: entity.fot_id,
    attraction_id: entity.atr_id,
    url: entity.fot_url,
    alt: entity.fot_alt,
    order: entity.fot_orden,
  };
}
