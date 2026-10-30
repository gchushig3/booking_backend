import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  resolveBoolean,
  resolveNumber,
  resolveTrimmedString,
  resolveValue,
} from '../../../common/dto/dto-utils.js';

export class CreateCategoryDto {
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'nombre'),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @ApiProperty({
    type: String,
    maxLength: 80,
    minLength: 1,
    example: 'Cultural',
  })
  name!: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'cat_slug'),
  )
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 80,
    example: 'recorrido-cultural-quito',
  })
  slug?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'descripcion'),
  )
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 255,
    example: 'Recorrido guiado por el centro histórico de Quito.',
  })
  description?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'icono'),
  )
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 40,
    default: 'map-pin',
    example: 'map-pin',
  })
  icon?: string = 'map-pin';

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveNumber(value, obj, 'orden'),
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

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveValue<number | null>(value, obj, 'padre_id'),
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
  parent_id?: number | null;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveBoolean(value, obj, 'activa'),
  )
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    type: Boolean,
    nullable: true,
    default: true,
    example: true,
  })
  active?: boolean = true;
}
