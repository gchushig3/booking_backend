import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  resolveBoolean,
  resolveNumber,
  resolveTrimmedString,
} from '../../../common/dto/dto-utils.js';

export class UpdateOperatorDto {
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveNumber(value, obj, 'codigo'),
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
  code?: number;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'nombre'),
  )
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 150,
    example: 'Recorrido cultural de Quito',
  })
  name?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'ruc'),
  )
  @IsOptional()
  @Matches(/^[0-9]{13}$/, {
    message: 'El RUC debe tener exactamente 13 dígitos numéricos',
  })
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    pattern: '^[0-9]{13}$',
    example: '1790012345001',
  })
  ruc?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'correo'),
  )
  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico tiene un formato inválido' })
  @MaxLength(160)
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 160,
    format: 'email',
    example: 'contacto@example.com',
  })
  email?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'telefono'),
  )
  @IsOptional()
  @Matches(/^\+?[0-9]{7,15}$/, {
    message:
      'El teléfono debe contener entre 7 y 15 dígitos con prefijo opcional +',
  })
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    pattern: '^\\+?[0-9]{7,15}$',
    example: '+593999123456',
  })
  phone?: string;

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
    resolveNumber(value, obj, 'prov_id'),
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
  province_id?: number;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveBoolean(value, obj, 'activo'),
  )
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ type: Boolean, nullable: true, example: true })
  active?: boolean;
}
