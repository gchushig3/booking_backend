import {
  HttpException,
  Inject,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { createHash } from 'node:crypto';
import { AuthService } from './auth.service.js';
import { PUBLIC_ROUTE, THROTTLE, REQUIRED_ROLES } from './auth.decorators.js';
import type { AuthRequest } from './auth.decorators.js';
import { AUTH_SETTINGS } from './auth.settings.js';
import type { AuthSettings } from './auth.settings.js';
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const match =
      /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(
        request.headers.authorization ?? '',
      );
    const token = match?.[1];
    if (!token || token.length > 8192)
      throw new UnauthorizedException('Invalid or expired credentials.');
    request.principal = await this.auth.authenticate(token);
    return true;
  }
}
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ROLES,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;
    const principal = context
      .switchToHttp()
      .getRequest<AuthRequest>().principal;
    if (!principal)
      throw new UnauthorizedException('Invalid or expired credentials.');
    if (!required.some((role) => principal.roles.includes(role)))
      throw new ForbiddenException('Insufficient permissions.');
    return true;
  }
}
@Injectable()
export class AuthRateGuard implements CanActivate {
  private readonly buckets = new Map<
    string,
    { count: number; until: number }
  >();
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_SETTINGS) private readonly settings: AuthSettings,
  ) {}
  canActivate(context: ExecutionContext): boolean {
    const kind = this.reflector.getAllAndOverride<
      'login' | 'recovery' | 'token'
    >(THROTTLE, [context.getHandler(), context.getClass()]);
    if (!kind) return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const now = Date.now();
    for (const [key, value] of this.buckets)
      if (value.until <= now) this.buckets.delete(key);
    const window = kind === 'recovery' ? 900000 : 60000;
    const limit =
      kind === 'login'
        ? this.settings.loginLimit
        : kind === 'recovery'
          ? this.settings.recoveryLimit
          : 30;
    const scope = `${kind}:${request.path}`;
    const keys = [
      `${scope}:ip:${request.ip ?? request.socket.remoteAddress ?? 'unknown'}`,
    ];
    const body: unknown = request.body;
    if (
      body &&
      typeof body === 'object' &&
      'email' in body &&
      typeof body.email === 'string'
    ) {
      keys.push(
        `${scope}:email:${createHash('sha256').update(body.email.trim().toLowerCase()).digest('hex')}`,
      );
    }
    for (const key of keys) {
      const existing = this.buckets.get(key);
      if (
        (existing && existing.count >= limit) ||
        (!existing && this.buckets.size >= 10000)
      ) {
        response.setHeader(
          'Retry-After',
          Math.ceil(((existing?.until ?? now + window) - now) / 1000),
        );
        throw new HttpException('Too many requests. Try again later.', 429);
      }
    }
    for (const key of keys) {
      const existing = this.buckets.get(key);
      this.buckets.set(key, {
        count: (existing?.count ?? 0) + 1,
        until: existing?.until ?? now + window,
      });
    }
    return true;
  }
}
