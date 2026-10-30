import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Header,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { CurrentPrincipal, Public, Throttle } from './auth.decorators.js';
import type { Principal, AuthRequest } from './auth.decorators.js';
import {
  RegisterDto,
  LoginDto,
  RefreshDto,
  EmailDto,
  VerificationDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './auth.dto.js';
import { IdentityJwtService } from './jwt.service.js';
import { ApiTags, ApiParam } from '@nestjs/swagger';
import { ApiEndpoint } from '../openapi/endpoint.js';
import {
  RegisterResponse,
  TokenPairResponse,
  MessageResponse,
  AuthMeResponse,
  SessionResponse,
  JwksResponse,
} from '../openapi/responses.js';
@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public()
  @Throttle('recovery')
  @Post('register')
  @ApiEndpoint({
    summary: 'Registrar un CLIENTE',
    access: 'public',
    status: 201,
    type: RegisterResponse,
    errors: [400, 409],
    throttled: true,
    description:
      'Siempre CLIENTE; no acepta roles, active ni verified. Correo real capturado en Mailpit. Límite recovery: 3 por ruta/IP/email cada 15 minutos.',
  })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }
  @Public()
  @Throttle('login')
  @Post('login')
  @HttpCode(200)
  @ApiEndpoint({
    summary: 'Iniciar sesión y obtener tokens',
    access: 'public',
    type: TokenPairResponse,
    errors: [400, 401],
    throttled: true,
    description:
      'Sin Authorization previo. Admite usuario activo aún no verificado. Credenciales inválidas: mensaje genérico. Límite: 5 intentos por minuto por ruta/IP/email.',
  })
  login(@Body() dto: LoginDto, @Req() request: AuthRequest) {
    return this.auth.login(dto, {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }
  @Public()
  @Throttle('token')
  @Post('refresh')
  @HttpCode(200)
  @ApiEndpoint({
    summary: 'Renovar tokens',
    access: 'public',
    type: TokenPairResponse,
    errors: [400, 401],
    throttled: true,
    description:
      'Usar refresh_token vigente, sin access JWT. Rotación atómica, sesión absoluta de siete días. Reutilización firmada revoca la sesión; serializar refresh en el cliente. 30 solicitudes/minuto/IP.',
  })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refresh_token);
  }
  @Public()
  @Throttle('recovery')
  @Post('verify-email')
  @HttpCode(204)
  @ApiEndpoint({
    summary: 'Verificar correo',
    access: 'public',
    status: 204,
    errors: [400],
    throttled: true,
    description:
      'Token EMAIL recibido en Mailpit, expira en 24h y se consume una vez. Límite recovery: 3 por ruta/IP cada 15 minutos.',
  })
  verifyEmail(@Body() dto: VerificationDto) {
    return this.auth.verifyEmail(dto.token);
  }
  @Public()
  @Throttle('recovery')
  @Post('resend-verification')
  @HttpCode(200)
  @ApiEndpoint({
    summary: 'Reenviar verificación',
    access: 'public',
    type: MessageResponse,
    errors: [400],
    throttled: true,
    description:
      'Respuesta genérica; invalida el EMAIL anterior si la cuenta es elegible. Límite recovery: 3 por ruta/IP/email cada 15 minutos.',
  })
  resend(@Body() dto: EmailDto) {
    return this.auth.requestVerification(dto.email, 'EMAIL');
  }
  @Public()
  @Throttle('recovery')
  @Post('forgot-password')
  @HttpCode(200)
  @ApiEndpoint({
    summary: 'Solicitar recuperación',
    access: 'public',
    type: MessageResponse,
    errors: [400],
    throttled: true,
    description:
      'Respuesta genérica para cuentas desconocidas/inactivas/elegibles. Token RECUPERACION en Mailpit, expira en 15 minutos. Límite recovery: 3 por ruta/IP/email cada 15 minutos.',
  })
  forgot(@Body() dto: EmailDto) {
    return this.auth.requestVerification(dto.email, 'RECUPERACION');
  }
  @Public()
  @Throttle('recovery')
  @Post('reset-password')
  @HttpCode(204)
  @ApiEndpoint({
    summary: 'Restablecer contraseña',
    access: 'public',
    status: 204,
    errors: [400],
    throttled: true,
    description:
      'Token RECUPERACION de un uso; revoca todas las sesiones y recuperaciones pendientes. Volver a login. Límite recovery: 3 por ruta/IP cada 15 minutos.',
  })
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.new_password);
  }
  @Get('me')
  @ApiEndpoint({
    summary: 'Consultar identidad autenticada',
    access: 'authenticated',
    type: AuthMeResponse,
  })
  me(@CurrentPrincipal() principal: Principal) {
    return this.auth.me(principal);
  }
  @Post('logout')
  @HttpCode(204)
  @ApiEndpoint({
    summary: 'Cerrar sesión actual',
    access: 'authenticated',
    status: 204,
    description:
      'Revoca también el acceso con el access actual y la posibilidad de renovar esta sesión.',
  })
  logout(@CurrentPrincipal() principal: Principal) {
    return this.auth.logout(principal);
  }
  @Post('logout-all')
  @HttpCode(204)
  @ApiEndpoint({
    summary: 'Cerrar todas las sesiones propias',
    access: 'authenticated',
    status: 204,
  })
  logoutAll(@CurrentPrincipal() principal: Principal) {
    return this.auth.logout(principal, true);
  }
  @Get('sessions')
  @ApiEndpoint({
    summary: 'Listar sesiones propias vigentes',
    access: 'authenticated',
    type: SessionResponse,
    array: true,
  })
  sessions(@CurrentPrincipal() principal: Principal) {
    return this.auth.sessions(principal);
  }
  @Delete('sessions/:id')
  @HttpCode(204)
  @ApiEndpoint({
    summary: 'Revocar una sesión propia',
    access: 'authenticated',
    status: 204,
    errors: [400, 404],
    description: 'Una sesión ajena se trata como inexistente (404).',
  })
  @ApiParam({
    name: 'id',
    schema: { type: 'string', format: 'uuid' },
    description: 'UUID v4 de la sesión propia.',
  })
  revoke(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.auth.revokeSession(principal, id);
  }
  @Patch('change-password')
  @HttpCode(204)
  @ApiEndpoint({
    summary: 'Cambiar contraseña con la actual',
    access: 'authenticated',
    status: 204,
    errors: [400],
    description:
      'Contraseña actual incorrecta: 401. La nueva debe diferir. Revoca todas las sesiones, incluida esta, y los tokens de recuperación pendientes.',
  })
  change(
    @CurrentPrincipal() principal: Principal,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(
      principal,
      dto.current_password,
      dto.new_password,
    );
  }
}
@ApiTags('Claves públicas')
@Controller('.well-known')
export class JwksController {
  constructor(private readonly jwt: IdentityJwtService) {}
  @Public()
  @Get('jwks.json')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiEndpoint({
    summary: 'Obtener JWKS público',
    access: 'public',
    type: JwksResponse,
    description:
      'Solo parámetros públicos RSA. Cache-Control: public, max-age=60. No contiene privadas ni secretos.',
  })
  keys() {
    return this.jwt.jwks();
  }
}
