import {
  SetMetadata,
  createParamDecorator,
  UnauthorizedException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
export const PUBLIC_ROUTE = 'identity:public';
export const THROTTLE = 'identity:throttle';
export const REQUIRED_ROLES = 'identity:roles';
export const Roles = (...roles: Array<'ADMIN' | 'OPERADOR' | 'CLIENTE'>) =>
  SetMetadata(REQUIRED_ROLES, roles);
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const Throttle = (kind: 'login' | 'recovery' | 'token') =>
  SetMetadata(THROTTLE, kind);
export interface Principal {
  userId: string;
  sessionId: string;
  roles: string[];
}
export interface AuthRequest extends Request {
  principal?: Principal;
}
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const principal = context
      .switchToHttp()
      .getRequest<AuthRequest>().principal;
    if (!principal) throw new UnauthorizedException();
    return principal;
  },
);
