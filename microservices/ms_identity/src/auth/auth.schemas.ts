import {
  RegisterDto,
  LoginDto,
  RefreshDto,
  EmailDto,
  VerificationDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './auth.dto.js';

const email = { type: 'string', maxLength: 160, minLength: 1 };
const password = {
  type: 'string',
  minLength: 1,
  maxLength: 72,
  pattern: '^[^\\u0000]*$',
};
const newPassword = { ...password, minLength: 12 };
const token = { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$' };
const object = (properties: object, required: string[]) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
});

// DTOs mantienen normalizacion de correo, limite bcrypt de 72 bytes y politicas de dominio.
export const authSchemas = new Map<Function, object>([
  [
    RegisterDto,
    object(
      {
        email,
        password: newPassword,
        first_name: { type: 'string', minLength: 1, maxLength: 120 },
        last_name: { type: 'string', minLength: 1, maxLength: 120 },
      },
      ['email', 'password', 'first_name', 'last_name'],
    ),
  ],
  [LoginDto, object({ email, password }, ['email', 'password'])],
  [
    RefreshDto,
    object(
      { refresh_token: { type: 'string', minLength: 1, maxLength: 8192 } },
      ['refresh_token'],
    ),
  ],
  [EmailDto, object({ email }, ['email'])],
  [VerificationDto, object({ token }, ['token'])],
  [
    ResetPasswordDto,
    object({ token, new_password: newPassword }, ['token', 'new_password']),
  ],
  [
    ChangePasswordDto,
    object({ current_password: password, new_password: newPassword }, [
      'current_password',
      'new_password',
    ]),
  ],
]);
