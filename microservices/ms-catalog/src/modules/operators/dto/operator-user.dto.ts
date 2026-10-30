import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  resolveBoolean,
  resolveTrimmedString,
  resolveUpperString,
} from '../../../common/dto/dto-utils.js';

export class AssociateOperatorUserDto {
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveTrimmedString(value, obj, 'usu_id'),
  )
  @IsString()
  @IsNotEmpty({ message: 'El usu_id del usuario es obligatorio' })
  @ApiProperty({ type: String, minLength: 1, example: '1' })
  user_id!: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveUpperString(value, obj, 'cargo'),
  )
  @IsIn(['ADMIN', 'VENDEDOR', 'GUIA'], {
    message: 'El cargo debe ser ADMIN, VENDEDOR o GUIA',
  })
  @ApiProperty({
    type: String,
    enum: ['ADMIN', 'VENDEDOR', 'GUIA'],
    example: 'GUIA',
    description: 'Cargo de asociación; no representa un rol JWT aprobado.',
  })
  role!: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveBoolean(value, obj, 'activo'),
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

export class UpdateOperatorUserDto {
  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveUpperString(value, obj, 'cargo'),
  )
  @IsOptional()
  @IsIn(['ADMIN', 'VENDEDOR', 'GUIA'], {
    message: 'El cargo debe ser ADMIN, VENDEDOR o GUIA',
  })
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    enum: ['ADMIN', 'VENDEDOR', 'GUIA'],
    example: 'GUIA',
    description: 'Cargo de asociación; no representa un rol JWT aprobado.',
  })
  role?: string;

  @Transform(({ value, obj }: { value: unknown; obj: unknown }) =>
    resolveBoolean(value, obj, 'activo'),
  )
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ type: Boolean, nullable: true, example: true })
  active?: boolean;
}

export class OperatorUserResponseDto {
  @ApiProperty({ type: String, example: '1', readOnly: true })
  operator_id!: string;
  @ApiProperty({ type: String, example: '1', readOnly: true })
  user_id!: string;
  @ApiProperty({
    type: String,
    example: 'GUIA',
    readOnly: true,
    description: 'Cargo de asociación; no representa un rol JWT aprobado.',
  })
  role!: string;
  @ApiProperty({ type: Boolean, example: true, readOnly: true })
  active!: boolean;
}
