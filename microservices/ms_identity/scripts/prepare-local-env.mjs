import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const test = process.argv.includes('--test');
const name = test ? '.env.test' : '.env';
const values = [
  `NODE_ENV=${test ? 'test' : 'development'}`,
  `APP_ENV=${test ? 'test' : 'local'}`,
  'PORT=3011',
  'DB_HOST=127.0.0.1',
  `DB_PORT=${test ? '5442' : '5441'}`,
  `DB_USERNAME=${test ? 'identity_test_local' : 'identity_local'}`,
  `DB_PASSWORD=${randomBytes(32).toString('hex')}`,
  `DB_DATABASE=${test ? 'ms_identity_test' : 'ms_identity'}`,
  'SMTP_HOST=127.0.0.1',
  'SMTP_PORT=1025',
  'SMTP_FROM=noreply@identity.local',
  'MAILPIT_UI_PORT=8025',
  'CORS_ORIGINS=',
  `BOOKING_API_KEY=${randomBytes(32).toString('hex')}`,
  '',
].join('\n');
try {
  await writeFile(new URL(`../${name}`, import.meta.url), values, {
    flag: 'wx',
    mode: 0o600,
  });
  console.log(`${name} created with a random password; values not printed.`);
} catch (error) {
  if (error.code === 'EEXIST')
    console.log(`${name} already exists; unchanged.`);
  else throw error;
}
