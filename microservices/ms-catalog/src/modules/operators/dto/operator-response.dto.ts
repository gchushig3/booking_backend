import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { OperadorEntity } from '../../../database/entities/operador.entity.js';
import type { OperadorUsuarioEntity } from '../../../database/entities/operador-usuario.entity.js';
import { OperatorUserResponseDto } from './operator-user.dto.js';

export class OperatorResponseDto {
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
  @ApiProperty({
    type: String,
    nullable: true,
    example: '1790012345001',
    readOnly: true,
  })
  ruc!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'contacto@example.com',
    readOnly: true,
  })
  email!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    example: '+593999123456',
    readOnly: true,
  })
  phone!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Centro histórico, Quito',
    readOnly: true,
  })
  address!: string | null;
  @ApiProperty({ type: 'integer', example: 1, readOnly: true })
  province_id!: number;
  @ApiProperty({ type: Boolean, example: true, readOnly: true })
  active!: boolean;
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
    type: () => OperatorUserResponseDto,
    isArray: true,
    readOnly: true,
  })
  users?: OperatorUserResponseDto[];
}

export function toOperatorUserResponseDto(
  entity: OperadorUsuarioEntity,
): OperatorUserResponseDto {
  return {
    operator_id: entity.ope_id,
    user_id: entity.usu_id,
    role: entity.opeu_cargo,
    active: entity.opeu_activo,
  };
}

export function toOperatorResponseDto(
  entity: OperadorEntity,
): OperatorResponseDto {
  return {
    id: entity.ope_id,
    code: entity.ope_codigo,
    name: entity.ope_nombre,
    ruc: entity.ope_ruc,
    email: entity.ope_correo,
    phone: entity.ope_telefono,
    address: entity.ope_direccion,
    province_id: entity.prov_id,
    active: entity.ope_activo,
    created_at:
      entity.ope_creado_en?.toISOString?.() ?? String(entity.ope_creado_en),
    updated_at:
      entity.ope_actualizado_en?.toISOString?.() ??
      String(entity.ope_actualizado_en),
    users: entity.usuarios
      ? entity.usuarios.map(toOperatorUserResponseDto)
      : undefined,
  };
}
