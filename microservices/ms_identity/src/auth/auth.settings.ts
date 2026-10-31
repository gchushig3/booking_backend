import { ConfigService } from '@nestjs/config';
import type { IdentityEnvironment } from '../config/environment.js';

export const AUTH_SETTINGS = Symbol('AUTH_SETTINGS');
export interface AuthSettings {
  keyringPath?: string;
  keyringJson?: string;
  issuer: string;
  accessAudience: string;
  refreshAudience: string;
  accessSeconds: number;
  refreshSeconds: number;
  bcryptRounds: number;
  loginLimit: number;
  recoveryLimit: number;
}
export function authSettings(config: ConfigService): AuthSettings {
  const env = config.getOrThrow<IdentityEnvironment>('identity');
  function integer(
    key: string,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const raw = config.get<unknown>(key) ?? fallback;
    if (
      (typeof raw !== 'number' && typeof raw !== 'string') ||
      !/^\d+$/.test(String(raw))
    )
      throw new Error(`Invalid ${key}`);
    const value = Number(raw);
    if (value < min || value > max) throw new Error(`Invalid ${key}`);
    return value;
  }
  const configuredPath = config.get<string>('JWT_KEYRING_PATH')?.trim();
  const keyringJson = config.get<string>('JWT_KEYRING_JSON')?.trim();
  if (configuredPath && keyringJson)
    throw new Error('Configure only one of JWT_KEYRING_PATH or JWT_KEYRING_JSON');
  const keyringPath =
    configuredPath ??
    (keyringJson
      ? undefined
      : env.APP_ENV === 'test'
        ? '.keys/identity.test.json'
        : env.APP_ENV === 'production'
          ? undefined
          : '.keys/identity.local.json');
  if (env.APP_ENV === 'production' && !keyringPath && !keyringJson)
    throw new Error('Production requires JWT_KEYRING_PATH or JWT_KEYRING_JSON');
  if (!keyringPath && !keyringJson)
    throw new Error('Invalid JWT_KEYRING_PATH');
  if (keyringJson) {
    try {
      JSON.parse(keyringJson);
    } catch {
      throw new Error('Invalid JWT_KEYRING_JSON');
    }
  }
  const issuer = config.get<string>('JWT_ISSUER') ?? 'urn:descubreec:identity';
  if (
    typeof issuer !== 'string' ||
    issuer !== issuer.trim() ||
    issuer.length > 256 ||
    !URL.canParse(issuer)
  )
    throw new Error('Invalid JWT_ISSUER');
  return {
    keyringPath,
    keyringJson,
    issuer,
    accessAudience: 'urn:descubreec:internal-api',
    refreshAudience: 'urn:descubreec:identity:refresh',
    accessSeconds: integer('JWT_ACCESS_TTL_SECONDS', 900, 1, 3600),
    refreshSeconds: 604800,
    bcryptRounds: integer(
      'BCRYPT_ROUNDS',
      12,
      env.APP_ENV === 'test' ? 4 : 10,
      14,
    ),
    loginLimit: integer(
      'AUTH_LOGIN_LIMIT',
      5,
      1,
      env.APP_ENV === 'test' ? 1000 : 20,
    ),
    recoveryLimit: integer(
      'AUTH_RECOVERY_LIMIT',
      3,
      1,
      env.APP_ENV === 'test' ? 1000 : 10,
    ),
  };
}
