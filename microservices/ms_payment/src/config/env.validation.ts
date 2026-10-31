import { databaseEnvironment } from '@booking/infrastructure';
const requiredVariables = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
  'NODE_ENV',
] as const;
const allowedNodeEnvironments = new Set(['development', 'test', 'production']);

function requiredString(
  config: Record<string, unknown>,
  name: (typeof requiredVariables)[number],
): string {
  const value = config[name];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  config = databaseEnvironment(config);
  const missingVariables = requiredVariables.filter((name) => {
    const value = config[name];
    return typeof value !== 'string' || value.trim().length === 0;
  });

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(', ')}`,
    );
  }

  const portValue = requiredString(config, 'DB_PORT');
  if (!/^[0-9]+$/.test(portValue)) {
    throw new Error('DB_PORT must be an integer between 1 and 65535');
  }

  const port = Number(portValue);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be an integer between 1 and 65535');
  }

  const nodeEnvironment = requiredString(config, 'NODE_ENV');
  if (!allowedNodeEnvironments.has(nodeEnvironment)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const host = requiredString(config, 'DB_HOST');
  const database = requiredString(config, 'DB_DATABASE');
  const simulationEnabled = config.SIMULATION_ENABLED;
  if (
    simulationEnabled !== undefined &&
    simulationEnabled !== 'true' &&
    simulationEnabled !== 'false'
  ) {
    throw new Error('SIMULATION_ENABLED must be true or false');
  }
  if (nodeEnvironment === 'test') {
    const isolatedTestDatabase =
      host === '127.0.0.1' && port === 5434 && database === 'ms_payment_test';
    const localDevelopmentDatabase =
      (host === '127.0.0.1' || host === 'localhost') &&
      (port === 5432 || port === 5433) &&
      database === 'ms_payment';
    if (!isolatedTestDatabase && !localDevelopmentDatabase) {
      throw new Error(
        'Test environment must target the isolated test database or local development database',
      );
    }
  } else if (!['ms_payment', 'db_payment'].includes(database)) {
    throw new Error('DB_DATABASE must be ms_payment or db_payment');
  }

  return {
    ...config,
    DB_HOST: host,
    DB_PORT: port,
    DB_USERNAME: requiredString(config, 'DB_USERNAME'),
    DB_PASSWORD: requiredString(config, 'DB_PASSWORD'),
    DB_DATABASE: database,
    NODE_ENV: nodeEnvironment,
    SIMULATION_ENABLED:
      nodeEnvironment === 'production'
        ? 'false'
        : (simulationEnabled ?? 'false'),
  };
}
