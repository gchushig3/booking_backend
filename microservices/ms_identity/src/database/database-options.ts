import type { DataSourceOptions } from 'typeorm';
import { IDENTITY_ENTITIES } from './entities/index.js';
import type { IdentityEnvironment } from '../config/environment.js';
export function databaseOptions(env: IdentityEnvironment): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    entities: IDENTITY_ENTITIES,
    synchronize: false,
    dropSchema: false,
    migrationsRun: false,
    logging: false,
    connectTimeoutMS: 5000,
    extra: { max: 10, application_name: 'ms-identity' },
  };
}
