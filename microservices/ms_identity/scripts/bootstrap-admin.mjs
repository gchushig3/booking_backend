import 'reflect-metadata';
import { validateEnvironment } from '../dist/config/environment.js';
import { databaseOptions } from '../dist/database/database-options.js';
import { createIdentityDataSource } from '../dist/database/identity-domains.js';
import { bootstrapAdmin } from '../dist/users/bootstrap-admin.js';
let source;
try {
  const env = validateEnvironment(process.env);
  if (
    env.APP_ENV !== 'local' ||
    !['127.0.0.1', 'localhost'].includes(env.DB_HOST) ||
    process.env.IDENTITY_BOOTSTRAP_ENABLED !== 'true'
  )
    throw new Error('Local bootstrap disabled.');
  source = createIdentityDataSource(databaseOptions(env));
  await source.initialize();
  const result = await bootstrapAdmin(source, env, {
    enabled: process.env.IDENTITY_BOOTSTRAP_ENABLED,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    firstName: process.env.ADMIN_FIRST_NAME,
    lastName: process.env.ADMIN_LAST_NAME,
  });
  console.log(
    result === 'created'
      ? 'Initial local ADMIN created. Login using your private bootstrap file; no credentials printed.'
      : 'Existing active ADMIN preserved; no credentials or assignments changed.',
  );
} catch {
  console.error(
    'ADMIN bootstrap rejected or unavailable. Check explicit local enablement, generated credentials, database health, role seeds and absence of a different initial ADMIN. No account is automatically promoted or reset.',
  );
  process.exitCode = 1;
} finally {
  if (source?.isInitialized) await source.destroy();
}
