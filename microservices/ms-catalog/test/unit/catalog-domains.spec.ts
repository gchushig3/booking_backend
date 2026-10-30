import { describe, expect, it } from '@jest/globals';
import { createCatalogDataSource } from '../../src/database/catalog-domains.js';
import { databaseOptions } from '../../src/database/database-options.js';
import { validateEnvironment } from '../../src/config/environment.js';

const options = databaseOptions(
  validateEnvironment({
    NODE_ENV: 'test',
    DB_HOST: '127.0.0.1',
    DB_PORT: '5445',
    DB_USERNAME: 'fixture',
    DB_PASSWORD: 'unit-only',
    DB_DATABASE: 'ms_catalog_test',
  }),
);

describe('Adaptación de dominios Catalog sin DDL automático', () => {
  it('registra solo los cuatro dominios aprobados y no conecta al construir', () => {
    const source = createCatalogDataSource(options);
    expect(source.isInitialized).toBe(false);
    for (const domain of [
      'dom_correo',
      'dom_ruc',
      'dom_telefono',
      'dom_moneda',
    ]) {
      expect(source.driver.supportedDataTypes).toContain(domain);
    }
    expect(source.entityMetadatas).toHaveLength(0);
  });

  it.each(['synchronize', 'dropSchema', 'migrationsRun'])(
    'rechaza habilitar %s antes de conectar',
    (flag) => {
      expect(() =>
        createCatalogDataSource({ ...options, [flag]: true }),
      ).toThrow('DDL automático');
    },
  );

  it('rechaza otro motor antes de intentar cargar un driver', () => {
    expect(() =>
      createCatalogDataSource({ type: 'sqlite', database: ':memory:' }),
    ).toThrow('PostgreSQL');
  });
});
