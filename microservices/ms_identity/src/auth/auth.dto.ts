import { Transform } from 'class-transformer';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  Matches,
  ValidateBy,
} from 'class-validator';

function Password(min = 12): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      type: String,
      format: 'password',
      writeOnly: true,
      minLength: min,
      maxLength: 72,
      description: `Mínimo ${min} caracteres Unicode, máximo 72 bytes UTF-8 y sin NUL; no se recorta ni normaliza.`,
      example: 'Una-clave-local-segura-42!',
    }),
    ValidateBy({
      name: 'passwordPolicy',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          Array.from(value).length >= min &&
          Buffer.byteLength(value, 'utf8') <= 72 &&
          !value.includes('\0'),
        defaultMessage: () =>
          `Password requires at least ${min} characters and at most 72 UTF-8 bytes, without NUL.`,
      },
    }),
  );
}
export class EmailDto {
  @ApiProperty({
    type: String,
    maxLength: 160,
    pattern: '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$',
    description:
      'Se recorta y convierte a minúsculas; compatible con dom_correo.',
    example: 'ana@example.test',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/)
  @MaxLength(160)
  email!: string;
}
export class RegisterDto extends EmailDto {
  @Password() password!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ApiProperty({
    type: String,
    minLength: 1,
    maxLength: 120,
    description: 'Se recorta; no puede quedar vacío.',
    example: 'Ana',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  first_name!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @ApiProperty({
    type: String,
    minLength: 1,
    maxLength: 120,
    description: 'Se recorta; no puede quedar vacío.',
    example: 'Prueba',
  })
  last_name!: string;
}
export class LoginDto extends EmailDto {
  @Password(1) password!: string;
}
export class RefreshDto {
  @ApiProperty({
    type: String,
    minLength: 1,
    maxLength: 8192,
    writeOnly: true,
    description:
      'Refresh obtenido por login/renovación. Se rota; reutilizarlo revoca la sesión. No necesita access JWT.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(8192)
  refresh_token!: string;
}
export class VerificationDto {
  @ApiProperty({
    type: String,
    pattern: '^[A-Za-z0-9_-]{43}$',
    minLength: 43,
    maxLength: 43,
    writeOnly: true,
    description: 'Token opaco de un uso recibido en Mailpit; no es JWT.',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string;
}
export class ResetPasswordDto extends VerificationDto {
  @Password() new_password!: string;
}
export class ChangePasswordDto {
  @Password(1) current_password!: string;
  @Password() new_password!: string;
}
