import { describe, expect, it } from '@jest/globals';
import { validateEnvironment } from '../../src/config/environment.js';
import { databaseOptions } from '../../src/database/database-options.js';

const valid = {
  NODE_ENV: 'development',
  DB_HOST: '127.0.0.1',
  DB_PORT: '5444',
  DB_USERNAME: 'catalog_test_fixture',
  DB_PASSWORD: 'unit-test-only',
  DB_DATABASE: 'ms_catalog',
};

describe('Configuración de arranque', () => {
  it('normaliza puertos y aplica el puerto HTTP local', () => {
    expect(validateEnvironment(valid)).toMatchObject({
      PORT: 3014,
      DB_PORT: 5444,
    });
  });

  it.each(['', '0', '65536', '1.5', 'NaN'])(
    'rechaza puerto inválido %s',
    (value) => {
      expect(() => validateEnvironment({ ...valid, PORT: value })).toThrow(
        'PORT',
      );
    },
  );

  it.each(['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'])(
    'rechaza ausencia de %s',
    (key) => {
      expect(() => validateEnvironment({ ...valid, [key]: '' })).toThrow(key);
    },
  );

  it('no revela la contraseña al reportar configuración inválida', () => {
    expect(() =>
      validateEnvironment({ ...valid, DB_DATABASE: 'another_service' }),
    ).toThrow(
      /^Configuración inválida: DB_DATABASE no corresponde al entorno Catalog$/,
    );
  });

  it('rechaza la contraseña de la plantilla', () => {
    expect(() =>
      validateEnvironment({
        ...valid,
        DB_PASSWORD: 'REPLACE_WITH_LOCAL_RANDOM_PASSWORD',
      }),
    ).toThrow('DB_PASSWORD');
  });

  it('impide conectar tests a la base local de desarrollo', () => {
    expect(() => validateEnvironment({ ...valid, NODE_ENV: 'test' })).toThrow(
      'DB_DATABASE',
    );
  });

  it('permite únicamente la base aislada en test', () => {
    expect(
      validateEnvironment({
        ...valid,
        NODE_ENV: 'test',
        DB_DATABASE: 'ms_catalog_test',
      }).DB_DATABASE,
    ).toBe('ms_catalog_test');
  });

  it('rechaza un entorno no reconocido', () => {
    expect(() =>
      validateEnvironment({ ...valid, NODE_ENV: 'staging' }),
    ).toThrow('NODE_ENV');
  });

  it.each(['development', 'production', 'test'])(
    'prohíbe creación o borrado automático del esquema en %s',
    (nodeEnv) => {
      const env = validateEnvironment({
        ...valid,
        NODE_ENV: nodeEnv,
        DB_DATABASE: nodeEnv === 'test' ? 'ms_catalog_test' : 'ms_catalog',
      });
      expect(databaseOptions(env)).toMatchObject({
        synchronize: false,
        dropSchema: false,
        migrationsRun: false,
      });
    },
  );
});
