import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_ENDPOINT } from '../public-endpoint.decorator.js';

/** Consultar Identity preserva revocacion de sesiones y cambios de roles. */
@Injectable()
export class AdministrativeAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService = new ConfigService(),
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.get<boolean>(PUBLIC_ENDPOINT, context.getHandler()) ===
      true
    ) {
      return true;
    }
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    const token =
      /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(
        request.headers.authorization ?? '',
      )?.[1];
    if (!token || token.length > 8192)
      throw new UnauthorizedException('JWT requerido');
    const base = this.config.get<string>('IDENTITY_BASE_URL');
    const key = this.config.get<string>('BOOKING_API_KEY');
    if (!base || !key)
      throw new ServiceUnavailableException('Identity no configurado');
    let response: globalThis.Response;
    try {
      response = await fetch(
        `${base.replace(/\/$/, '')}/auth/booking/introspect`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': key },
          body: JSON.stringify({ access_token: token }),
          signal: AbortSignal.timeout(3000),
        },
      );
    } catch {
      throw new ServiceUnavailableException('Identity no disponible');
    }
    if (response.status === 401)
      throw new UnauthorizedException(
        'JWT o credenciales de integracion invalidos',
      );
    if (response.status === 403)
      throw new ForbiddenException('Identity denego el acceso');
    if (!response.ok)
      throw new ServiceUnavailableException('Identity no disponible');
    let principal: unknown;
    try {
      principal = await response.json();
    } catch {
      throw new ServiceUnavailableException('Respuesta Identity invalida');
    }
    if (
      !principal ||
      typeof principal !== 'object' ||
      !('roles' in principal) ||
      !Array.isArray(principal.roles)
    ) {
      throw new ServiceUnavailableException('Respuesta Identity invalida');
    }
    // Solo ADMIN puede modificar el catalogo completo; OPERADOR requiere reglas de propiedad adicionales.
    if (!principal.roles.includes('ADMIN'))
      throw new ForbiddenException('Se requiere rol ADMIN');
    return true;
  }
}
