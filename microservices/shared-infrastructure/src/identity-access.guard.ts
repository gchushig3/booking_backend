import { CanActivate, ExecutionContext, Injectable, ForbiddenException, UnauthorizedException, ServiceUnavailableException, SetMetadata } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

const PUBLIC = 'infrastructure.public';
const ROLES = 'infrastructure.roles';
export const PublicInfrastructure = () => SetMetadata(PUBLIC, true);
export const InfrastructureRoles = (...roles: string[]) => SetMetadata(ROLES, roles);
export interface SagaPrincipal { userId: string; sessionId: string; roles: string[] }
export interface SagaHttpRequest { headers: Record<string, string | undefined>; principal: SagaPrincipal }

@Injectable()
export class IdentityAccessGuard implements CanActivate {
  constructor(private readonly config: ConfigService, private readonly reflector: Reflector) {}
  async canActivate(context: ExecutionContext) {
    if (context.getType() !== 'http') return true;
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<SagaHttpRequest>();
    const token = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(request.headers.authorization ?? '')?.[1];
    if (!token || token.length > 8192) throw new UnauthorizedException('Access JWT required');
    let response: Response;
    try {
      const base = this.config.getOrThrow<string>('IDENTITY_BASE_URL');
      response = await fetch(`${base.replace(/\/$/, '')}/auth/booking/introspect`, { method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': this.config.getOrThrow<string>('BOOKING_API_KEY') },
        body: JSON.stringify({ access_token: token }), signal: AbortSignal.timeout(3000) });
    } catch { throw new ServiceUnavailableException('Identity unavailable'); }
    if (response.status === 401) throw new UnauthorizedException('Invalid session');
    if (response.status === 403) throw new ForbiddenException('Identity denied access');
    if (!response.ok) throw new ServiceUnavailableException('Identity unavailable');
    let value: unknown;
    try { value = await response.json(); } catch { throw new ServiceUnavailableException('Invalid Identity response'); }
    if (!value || typeof value !== 'object' || !('userId' in value) || typeof value.userId !== 'string' ||
      !/^[1-9]\d{0,18}$/.test(value.userId) || BigInt(value.userId) > 9223372036854775807n ||
      !('sessionId' in value) || typeof value.sessionId !== 'string' || !('roles' in value) ||
      !Array.isArray(value.roles) || !value.roles.length || !value.roles.every((role: unknown) => typeof role === 'string')) {
      throw new ServiceUnavailableException('Invalid Identity response');
    }
    request.principal = value as SagaPrincipal;
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES, [context.getHandler(), context.getClass()]);
    if (roles?.length && !roles.some((role) => request.principal.roles.includes(role))) throw new ForbiddenException('Insufficient role');
    return true;
  }
}
