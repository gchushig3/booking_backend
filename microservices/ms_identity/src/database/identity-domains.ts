import { DataSource } from 'typeorm';
import type { ColumnType, DataSourceOptions } from 'typeorm';

export const IDENTITY_DOMAINS = [
  'dom_correo',
  'dom_documento',
  'dom_telefono',
] as const;
type IdentityDomain = (typeof IDENTITY_DOMAINS)[number];

// TypeORM 0.3 no enumera dominios definidos por el usuario. La extensión queda
// limitada a estos tres nombres aprobados, por DataSource, sin modificar SQL.
export function identityDomain(name: IdentityDomain): ColumnType {
  return name as ColumnType;
}

export function createIdentityDataSource(
  options: DataSourceOptions,
): DataSource {
  if (options.type !== 'postgres') {
    throw new Error('Identity requiere PostgreSQL');
  }
  if (options.synchronize || options.dropSchema || options.migrationsRun) {
    throw new Error('Identity prohíbe DDL automático');
  }
  const source = new DataSource(options);
  source.driver.supportedDataTypes = [
    ...source.driver.supportedDataTypes,
    ...IDENTITY_DOMAINS.map(identityDomain),
  ];
  return source;
}
