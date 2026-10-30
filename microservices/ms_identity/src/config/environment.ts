import { databaseEnvironment } from '@booking/infrastructure';

export interface IdentityEnvironment {
  NODE_ENV: 'development' | 'test' | 'production';
  APP_ENV: 'local' | 'test' | 'production';
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: 'ms_identity' | 'ms_identity_test';
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_FROM: string;
  CORS_ORIGINS: string[];
}
function required(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`Missing configuration: ${key}`);
  return value;
}
function port(
  source: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = source[key] ?? fallback;
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    !/^\d+$/.test(String(value))
  )
    throw new Error(`Invalid port: ${key}`);
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 65535)
    throw new Error(`Invalid port: ${key}`);
  return number;
}
export function validateEnvironment(
  source: Record<string, unknown>,
): IdentityEnvironment {
  source = databaseEnvironment(source);
  const node = source.NODE_ENV ?? 'development';
  const app = required(source, 'APP_ENV');
  if (
    typeof node !== 'string' ||
    !['development', 'test', 'production'].includes(node)
  )
    throw new Error('Invalid NODE_ENV');
  if (!['local', 'test', 'production'].includes(app))
    throw new Error('Invalid APP_ENV');
  if ((node === 'test') !== (app === 'test'))
    throw new Error('Test environment mismatch');
  const database = required(source, 'DB_DATABASE');
  if (database !== (app === 'test' ? 'ms_identity_test' : 'ms_identity'))
    throw new Error('Invalid Identity database');
  const password = required(source, 'DB_PASSWORD');
  if (
    password === 'REPLACE_WITH_LOCAL_RANDOM_PASSWORD' ||
    (!source.DATABASE_URL && password.length < 24)
  )
    throw new Error(
      'DB_PASSWORD requires a local random value of at least 24 characters',
    );
  const origins =
    typeof source.CORS_ORIGINS === 'string'
      ? source.CORS_ORIGINS.split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  for (const origin of origins) {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin)
      throw new Error('Invalid CORS origin');
  }
  return {
    NODE_ENV: node as IdentityEnvironment['NODE_ENV'],
    APP_ENV: app as IdentityEnvironment['APP_ENV'],
    PORT: port(source, 'PORT', 3011),
    DB_HOST: required(source, 'DB_HOST'),
    DB_PORT: port(source, 'DB_PORT', 5432),
    DB_USERNAME: required(source, 'DB_USERNAME'),
    DB_PASSWORD: password,
    DB_DATABASE: database as IdentityEnvironment['DB_DATABASE'],
    SMTP_HOST: required(source, 'SMTP_HOST'),
    SMTP_PORT: port(source, 'SMTP_PORT', 1025),
    SMTP_FROM: required(source, 'SMTP_FROM'),
    CORS_ORIGINS: origins,
  };
}
