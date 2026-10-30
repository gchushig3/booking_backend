import { validateEnvironment } from './env.validation.js';

const baseEnvironment = {
  NODE_ENV: 'development',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'payment',
  DB_PASSWORD: 'local-only',
  DB_DATABASE: 'ms_payment',
};

describe('validateEnvironment', () => {
  it('accepts the isolated test database only at its fixed local target', () => {
    expect(
      validateEnvironment({
        ...baseEnvironment,
        NODE_ENV: 'test',
        DB_HOST: '127.0.0.1',
        DB_PORT: '5434',
        DB_DATABASE: 'ms_payment_test',
      }),
    ).toMatchObject({
      NODE_ENV: 'test',
      DB_HOST: '127.0.0.1',
      DB_PORT: 5434,
      DB_DATABASE: 'ms_payment_test',
    });
  });

  it.each([
    { DB_DATABASE: 'ms_payment' },
    { DB_HOST: 'localhost' },
    { DB_PORT: '5433' },
  ])('rejects a test target outside the isolated database', (override) => {
    expect(() =>
      validateEnvironment({
        ...baseEnvironment,
        NODE_ENV: 'test',
        DB_HOST: '127.0.0.1',
        DB_PORT: '5434',
        DB_DATABASE: 'ms_payment_test',
        ...override,
      }),
    ).toThrow(
      'Test environment must target the isolated test database or local development database',
    );
  });

  it('allows the local development database for read-only e2e tests', () => {
    expect(
      validateEnvironment({
        ...baseEnvironment,
        NODE_ENV: 'test',
      }),
    ).toMatchObject({
      NODE_ENV: 'test',
      DB_DATABASE: 'ms_payment',
    });
  });

  it('continues to require the development database outside test mode', () => {
    expect(() =>
      validateEnvironment({
        ...baseEnvironment,
        DB_DATABASE: 'ms_payment_test',
      }),
    ).toThrow('DB_DATABASE must be ms_payment');
  });

  it('defaults simulation to disabled and forces it off in production', () => {
    expect(validateEnvironment(baseEnvironment).SIMULATION_ENABLED).toBe(
      'false',
    );
    expect(
      validateEnvironment({
        ...baseEnvironment,
        NODE_ENV: 'production',
        SIMULATION_ENABLED: 'true',
      }).SIMULATION_ENABLED,
    ).toBe('false');
  });
});
