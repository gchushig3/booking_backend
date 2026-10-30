import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class UserResponse {
  @ApiProperty({
    type: String,
    example: '9007199254740993',
    pattern: '^[1-9][0-9]{0,18}$',
    description: 'BIGINT PostgreSQL como string, nunca Number.',
  })
  id!: string;
  @ApiProperty({ example: 'ana@example.test', maxLength: 160 }) email!: string;
  @ApiProperty({ example: 'Ana', maxLength: 120 }) first_name!: string;
  @ApiProperty({ example: 'Prueba', maxLength: 120 }) last_name!: string;
  @ApiProperty({ type: String, nullable: true, example: null }) document!:
    | string
    | null;
  @ApiProperty({ type: String, nullable: true, example: '+593999999999' })
  phone!: string | null;
  @ApiProperty({ type: String, format: 'date', nullable: true, example: null })
  birth_date!: string | null;
  @ApiProperty({ type: String, nullable: true, example: null }) avatar_url!:
    | string
    | null;
  @ApiProperty({ example: false }) verified!: boolean;
  @ApiProperty({ example: true }) active!: boolean;
  @ApiProperty({
    type: [String],
    example: ['CLIENTE'],
    description: 'Solo roles activos; un usuario inactivo no obtiene acceso.',
  })
  roles!: string[];
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: null,
  })
  last_login_at!: string | null;
  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-10-29T12:00:00.000Z',
  })
  created_at!: string;
  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-10-29T12:00:00.000Z',
  })
  updated_at!: string;
}
export class RegisterResponse {
  @ApiProperty({ type: UserResponse }) user!: UserResponse;
  @ApiProperty({
    example: true,
    description:
      'Entrega SMTP real; false permite solicitar reenvío, sin deshacer el registro.',
  })
  verification_email_sent!: boolean;
}
export class AuthMeResponse {
  @ApiProperty({ type: UserResponse }) user!: UserResponse;
  @ApiProperty({
    format: 'uuid',
    example: 'c228d067-e81c-42d5-a514-e22ad293895b',
  })
  session_id!: string;
}
export class TokenPairResponse {
  @ApiProperty({
    description:
      'JWT RS256 de acceso. Copiar su valor en Authorize, sin el prefijo Bearer.',
  })
  access_token!: string;
  @ApiProperty({
    description:
      'JWT refresh, solo para /auth/refresh. Reemplazar ambos tokens tras renovar.',
  })
  refresh_token!: string;
  @ApiProperty({ enum: ['Bearer'], example: 'Bearer' }) token_type!: string;
  @ApiProperty({
    type: 'integer',
    example: 900,
    description: 'Segundos restantes del access; nunca supera la sesión.',
  })
  expires_in!: number;
  @ApiProperty({ format: 'date-time', example: '2026-11-05T12:00:00.000Z' })
  refresh_expires_at!: string;
}
export class MessageResponse {
  @ApiProperty({
    example: 'If the account is eligible, an email will be sent.',
  })
  message!: string;
}
export class SessionResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, nullable: true, example: '127.0.0.1' }) ip!:
    | string
    | null;
  @ApiProperty({ type: String, nullable: true, example: 'Swagger UI' })
  user_agent!: string | null;
  @ApiProperty({ format: 'date-time' }) expires_at!: string;
  @ApiProperty({ format: 'date-time' }) created_at!: string;
  @ApiProperty({ example: true }) current!: boolean;
}
export class RoleResponse {
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 32767, example: 1 })
  id!: number;
  @ApiProperty({ example: 'ADMIN', maxLength: 30 }) name!: string;
  @ApiProperty({ example: 'Administrador del sistema', maxLength: 200 })
  description!: string;
  @ApiProperty({ example: true }) active!: boolean;
}
export class AssignmentResponse extends RoleResponse {
  @ApiProperty({ format: 'date-time' }) assigned_at!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'BIGINT del actor; null en el bootstrap.',
  })
  assigned_by!: string | null;
}
export class UsersPageResponse {
  @ApiProperty({ type: [UserResponse] }) items!: UserResponse[];
  @ApiProperty({ type: 'integer', example: 1 }) total!: number;
  @ApiProperty({ type: 'integer', example: 1 }) page!: number;
  @ApiProperty({ type: 'integer', example: 20 }) limit!: number;
}
export class HealthResponse {
  @ApiProperty({ enum: ['UP'], example: 'UP' }) status!: string;
}
export class PublicJwkResponse {
  @ApiProperty({ enum: ['RSA'] }) kty!: string;
  @ApiProperty({ description: 'Módulo RSA público en base64url.' }) n!: string;
  @ApiProperty({ example: 'AQAB' }) e!: string;
  @ApiProperty({ enum: ['RS256'] }) alg!: string;
  @ApiProperty({ enum: ['sig'] }) use!: string;
  @ApiProperty({ format: 'uuid' }) kid!: string;
}
export class JwksResponse {
  @ApiProperty({ type: [PublicJwkResponse] }) keys!: PublicJwkResponse[];
}
export class ProblemResponse {
  @ApiProperty({ example: 'about:blank' }) type!: string;
  @ApiProperty({ example: 'Unauthorized' }) title!: string;
  @ApiProperty({ type: 'integer', example: 401 }) status!: number;
  @ApiProperty({ example: 'Invalid or expired credentials.' }) detail!: string;
  @ApiProperty({ example: '/api/v2/auth/me' }) instance!: string;
  @ApiProperty({ example: 'UNAUTHORIZED' }) code!: string;
  @ApiProperty({ example: 'cid-identity-example' }) correlation_id!: string;
  @ApiProperty({ format: 'date-time', example: '2026-10-29T12:00:00.000Z' })
  timestamp!: string;
  @ApiPropertyOptional({
    type: [String],
    description: 'Mensajes de validación, solo cuando corresponda.',
  })
  errors?: string[];
}
