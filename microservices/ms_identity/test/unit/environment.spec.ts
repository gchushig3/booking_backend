import { describe, expect, it } from '@jest/globals';
import { validateEnvironment } from '../../src/config/environment.js';
import { databaseOptions } from '../../src/database/database-options.js';

const valid = {
  APP_ENV: 'local',
  NODE_ENV: 'development',
  DB_HOST: '127.0.0.1',
  DB_PORT: '5441',
  DB_USERNAME: 'identity_fixture',
  DB_PASSWORD: 'unit-fixture-password-not-operational',
  DB_DATABASE: 'ms_identity',
  SMTP_HOST: '127.0.0.1',
  SMTP_FROM: 'noreply@identity.local',
};
describe('Identity configuration', () => {
  it('normalizes ports without enabling schema changes', () => {
    const env = validateEnvironment(valid);
    expect(env).toMatchObject({
      PORT: 3011,
      DB_PORT: 5441,
      SMTP_PORT: 1025,
      CORS_ORIGINS: [],
    });
    expect(databaseOptions(env)).toMatchObject({
      synchronize: false,
      dropSchema: false,
      migrationsRun: false,
      logging: false,
    });
  });
  it.each([
    { APP_ENV: 'unknown' },
    { NODE_ENV: 'invalid' },
    { NODE_ENV: 'test' },
    { DB_DATABASE: 'ms_catalog' },
    { DB_PASSWORD: 'REPLACE_WITH_LOCAL_RANDOM_PASSWORD' },
    { DB_PASSWORD: '' },
    { DB_PORT: '5432x' },
    { PORT: '65536' },
    { SMTP_PORT: 0 },
    { CORS_ORIGINS: '*' },
    { CORS_ORIGINS: 'https://example.com/path' },
  ])('rejects invalid configuration %j', (change) => {
    expect(() => validateEnvironment({ ...valid, ...change })).toThrow();
  });
  it('allows the isolated test database only in the test environment', () => {
    expect(
      validateEnvironment({
        ...valid,
        APP_ENV: 'test',
        NODE_ENV: 'test',
        DB_DATABASE: 'ms_identity_test',
        DB_PORT: '5442',
      }).DB_DATABASE,
    ).toBe('ms_identity_test');
  });
  it('allows a production Node build in an explicitly local Compose environment', () => {
    expect(
      validateEnvironment({ ...valid, NODE_ENV: 'production' }).APP_ENV,
    ).toBe('local');
  });
  it('uses an explicit CORS allowlist without wildcard', () => {
    expect(
      validateEnvironment({
        ...valid,
        CORS_ORIGINS: 'http://localhost:5173,https://example.com',
      }).CORS_ORIGINS,
    ).toEqual(['http://localhost:5173', 'https://example.com']);
  });
});
