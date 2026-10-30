import { databaseEnvironment } from '@booking/infrastructure';

export interface Environment {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: 'ms_catalog' | 'db_catalog' | 'ms_catalog_test';
}

function requiredString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Configuración inválida: ${key} es obligatorio`);
  }
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
    !/^[0-9]+$/.test(String(value))
  ) {
    throw new Error(`Configuración inválida: ${key} debe ser un puerto entero`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(
      `Configuración inválida: ${key} debe estar entre 1 y 65535`,
    );
  }
  return parsed;
}

export function validateEnvironment(
  source: Record<string, unknown>,
): Environment {
  source = databaseEnvironment(source);
  const nodeEnv = source.NODE_ENV ?? 'development';
  if (
    nodeEnv !== 'development' &&
    nodeEnv !== 'test' &&
    nodeEnv !== 'production'
  ) {
    throw new Error('Configuración inválida: NODE_ENV no admitido');
  }
  const database = requiredString(source, 'DB_DATABASE');
  const allowedDatabases =
    nodeEnv === 'test' ? ['ms_catalog_test'] : ['ms_catalog', 'db_catalog'];
  if (!allowedDatabases.includes(database)) {
    throw new Error(
      'Configuración inválida: DB_DATABASE no corresponde al entorno Catalog',
    );
  }
  const password = requiredString(source, 'DB_PASSWORD');
  if (password === 'REPLACE_WITH_LOCAL_RANDOM_PASSWORD') {
    throw new Error(
      'Configuración inválida: sustituya DB_PASSWORD de la plantilla',
    );
  }
  return {
    NODE_ENV: nodeEnv,
    PORT: port(source, 'PORT', 3014),
    DB_HOST: requiredString(source, 'DB_HOST'),
    DB_PORT: port(source, 'DB_PORT', 5432),
    DB_USERNAME: requiredString(source, 'DB_USERNAME'),
    DB_PASSWORD: password,
    DB_DATABASE: database as Environment['DB_DATABASE'],
  };
}
