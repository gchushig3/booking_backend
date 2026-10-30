import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { validateEnvironment } from '../dist/config/environment.js';
import { databaseOptions } from '../dist/database/database-options.js';
import { createIdentityDataSource } from '../dist/database/identity-domains.js';
import { applyIdentitySchema } from '../dist/database/apply-identity-schema.js';
const env = validateEnvironment(process.env);
if (!['local', 'test'].includes(env.APP_ENV))
  throw new Error('Schema initialization is restricted to local/test');
if (
  env.APP_ENV === 'local' &&
  !['localhost', '127.0.0.1', 'postgres'].includes(env.DB_HOST)
)
  throw new Error('Local Identity database required');
const sql = await readFile(
  new URL('../database/migrations/001-identity.sql', import.meta.url),
  'utf8',
);
const source = createIdentityDataSource(databaseOptions(env));
try {
  await source.initialize();
  await applyIdentitySchema(source, sql);
  console.log(
    'Identity schema and original role seeds initialized once in a transaction.',
  );
} catch {
  console.error(
    'Identity initialization rejected or failed. Check target, version, SQL checksum and that the database is empty. Nothing is automatically dropped or retried.',
  );
  process.exitCode = 1;
} finally {
  if (source.isInitialized) await source.destroy();
}
