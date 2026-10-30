import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsInt, Min } from 'class-validator';
import { resolveNumberArray } from '../../../common/dto/dto-utils.js';

export class SyncCategoriesDto {
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveNumberArray(value, obj, 'categoria_ids'),
  )
  @IsArray({ message: 'category_ids debe ser un arreglo de números enteros' })
  @IsInt({
    each: true,
    message: 'Cada elemento en category_ids debe ser un número entero',
  })
  @Min(1, { each: true })
  @ApiProperty({
    type: 'array',
    items: { type: 'integer', minimum: 1 },
    example: [1],
  })
  category_ids!: number[];
}

export class SyncLanguagesDto {
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveNumberArray(value, obj, 'idioma_ids'),
  )
  @IsArray({ message: 'language_ids debe ser un arreglo de números enteros' })
  @IsInt({
    each: true,
    message: 'Cada elemento en language_ids debe ser un número entero',
  })
  @Min(1, { each: true })
  @ApiProperty({
    type: 'array',
    items: { type: 'integer', minimum: 1 },
    example: [1],
  })
  language_ids!: number[];
}

export class SyncInclusionsDto {
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveNumberArray(value, obj, 'inclusion_ids'),
  )
  @IsArray({ message: 'inclusion_ids debe ser un arreglo de números enteros' })
  @IsInt({
    each: true,
    message: 'Cada elemento en inclusion_ids debe ser un número entero',
  })
  @Min(1, { each: true })
  @ApiProperty({
    type: 'array',
    items: { type: 'integer', minimum: 1 },
    example: [1],
  })
  inclusion_ids!: number[];
}
