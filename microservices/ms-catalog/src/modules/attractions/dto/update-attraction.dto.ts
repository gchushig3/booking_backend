import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  resolveBoolean,
  resolveNumber,
  resolveTrimmedString,
  resolveUpperString,
} from '../../../common/dto/dto-utils.js';

export class UpdateAttractionDto {
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'nombre'),
  )
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 200,
    example: 'Recorrido cultural de Quito',
  })
  name?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'atr_slug'),
  )
  @IsOptional()
  @IsString()
  @MaxLength(220)
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 220,
    example: 'recorrido-cultural-quito',
  })
  slug?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'descripcion'),
  )
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Recorrido guiado por el centro histórico de Quito.',
  })
  description?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'descripcion_corta'),
  )
  @IsOptional()
  @IsString()
  @MaxLength(280)
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 280,
    example: 'Conoce el centro histórico de Quito.',
  })
  short_description?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveUpperString(value, obj, 'tipo'),
  )
  @IsOptional()
  @IsIn(['GUIDED_TOUR', 'ADMISSION', 'DAY_TRIP', 'TRANSPORT', 'PACKAGE'], {
    message:
      'El tipo debe ser GUIDED_TOUR, ADMISSION, DAY_TRIP, TRANSPORT o PACKAGE',
  })
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    enum: ['GUIDED_TOUR', 'ADMISSION', 'DAY_TRIP', 'TRANSPORT', 'PACKAGE'],
    example: 'GUIDED_TOUR',
  })
  type?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveNumber(value, obj, 'latitud'),
  )
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: -90,
    maximum: 90,
    example: -0.2202,
  })
  latitude?: number;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveNumber(value, obj, 'longitud'),
  )
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: -180,
    maximum: 180,
    example: -78.5123,
  })
  longitude?: number;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'direccion'),
  )
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 255,
    example: 'Centro histórico, Quito',
  })
  address?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'punto_encuentro'),
  )
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 255,
    example: 'Plaza Grande, Quito',
  })
  meeting_point?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveNumber(value, obj, 'duracion_horas'),
  )
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(720)
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0.01,
    maximum: 720,
    example: 2,
  })
  duration_hours?: number;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveUpperString(value, obj, 'moneda'),
  )
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    minLength: 3,
    maxLength: 3,
    example: 'USD',
  })
  currency?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveNumber(value, obj, 'ciu_id'),
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
  city_id?: number;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'ope_id'),
  )
  @IsOptional()
  @ApiPropertyOptional({ type: String, nullable: true, example: '1' })
  operator_id?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveBoolean(value, obj, 'cancelacion_gratuita'),
  )
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ type: Boolean, nullable: true, example: true })
  free_cancellation?: boolean;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveNumber(value, obj, 'horas_cancelacion'),
  )
  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({
    type: 'integer',
    nullable: true,
    minimum: 0,
    example: 1,
  })
  cancellation_hours?: number;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveBoolean(value, obj, 'destacada'),
  )
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ type: Boolean, nullable: true, example: true })
  featured?: boolean;
}
