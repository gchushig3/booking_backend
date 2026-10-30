import type { DataSourceOptions } from 'typeorm';
import { CATALOG_ENTITIES } from './entities/index.js';
import type { Environment } from '../config/environment.js';

export function databaseOptions(env: Environment): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    entities: CATALOG_ENTITIES,
    synchronize: false,
    dropSchema: false,
    migrationsRun: false,
    logging: false,
    connectTimeoutMS: 5000,
    extra: { max: 10, application_name: 'ms-catalog' },
  };
}
