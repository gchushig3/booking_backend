import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateBy,
} from 'class-validator';
const present = (_object: unknown, value: unknown) => value !== undefined;
const nullable = (_object: unknown, value: unknown) =>
  value !== undefined && value !== null;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class ProfileDto {
  @ApiPropertyOptional({
    type: String,
    minLength: 1,
    maxLength: 120,
    example: 'Ana',
    description: 'Trim; no permite null ni blanco.',
  })
  @ValidateIf(present)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  first_name?: string;
  @ValidateIf(present)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @ApiPropertyOptional({
    type: String,
    minLength: 1,
    maxLength: 120,
    example: 'Prueba',
    description: 'Trim; no permite null ni blanco.',
  })
  last_name?: string;
  @ValidateIf(nullable)
  @IsString()
  @Matches(/^(?:[0-9]{10}|[A-Z]{1,2}[0-9]{6,9})$/)
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 20,
    pattern: '^(?:[0-9]{10}|[A-Z]{1,2}[0-9]{6,9})$',
    example: null,
  })
  document?: string | null;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    pattern: '^\\+?[0-9]{7,15}$',
    example: '+593999999999',
  })
  @ValidateIf(nullable)
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/)
  phone?: string | null;
  @ValidateIf(nullable)
  @ValidateBy({
    name: 'calendarDate',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number(value.slice(0, 4)) >= 1 &&
        !Number.isNaN(Date.parse(value + 'T00:00:00Z')) &&
        new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value,
      defaultMessage: () => 'birth_date must be a valid YYYY-MM-DD date',
    },
  })
  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
    example: '2000-02-29',
    description: 'Fecha real, año >= 0001. null permite limpiar.',
  })
  birth_date?: string | null;
  @ValidateIf(nullable)
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
    disallow_auth: true,
  })
  @MaxLength(255)
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 255,
    example: 'https://example.test/avatar.jpg',
    description:
      'Solo HTTP/HTTPS con protocolo y sin credenciales; null permite limpiar.',
  })
  avatar_url?: string | null;
}
export class StatusDto {
  @ApiProperty({
    type: Boolean,
    example: false,
    description:
      'false revoca sesiones/tokens pendientes. No permite auto-desactivación ADMIN.',
  })
  @IsBoolean()
  active!: boolean;
}
export class AssignRoleDto {
  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: 32767,
    example: 2,
    description: 'Rol existente y activo. No se editan roles propios.',
  })
  @IsInt()
  @Min(1)
  @Max(32767)
  role_id!: number;
}
export class PaginationDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 1000000,
    default: 1,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
