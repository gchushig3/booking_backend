import { DataSource } from 'typeorm';
import type { ColumnType, DataSourceOptions } from 'typeorm';

export const CATALOG_DOMAINS = [
  'dom_correo',
  'dom_ruc',
  'dom_telefono',
  'dom_moneda',
] as const;
type CatalogDomain = (typeof CATALOG_DOMAINS)[number];

// TypeORM 0.3 no enumera dominios definidos por el usuario. La extensión queda
// limitada a estos cuatro nombres aprobados, por DataSource, sin modificar SQL.
export function catalogDomain(name: CatalogDomain): ColumnType {
  return name as ColumnType;
}

export function createCatalogDataSource(
  options: DataSourceOptions,
): DataSource {
  if (options.type !== 'postgres') {
    throw new Error('Catalog requiere PostgreSQL');
  }
  if (options.synchronize || options.dropSchema || options.migrationsRun) {
    throw new Error('Catalog prohíbe DDL automático');
  }
  const source = new DataSource(options);
  source.driver.supportedDataTypes = [
    ...source.driver.supportedDataTypes,
    ...CATALOG_DOMAINS.map(catalogDomain),
  ];
  return source;
}
