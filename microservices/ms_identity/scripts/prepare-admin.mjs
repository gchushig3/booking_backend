import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';
const env = parseEnv(await readFile('.env', 'utf8'));
if (
  env.APP_ENV !== 'local' ||
  env.DB_DATABASE !== 'ms_identity' ||
  !['127.0.0.1', 'localhost'].includes(env.DB_HOST)
)
  throw new Error('Explicit local Identity configuration required.');
const index = process.argv.indexOf('--email');
const email = process.argv[index + 1]?.trim().toLowerCase();
if (
  index < 0 ||
  !email ||
  email.length > 160 ||
  !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)
)
  throw new Error('Provide --email with your initial administrator email.');
const password = randomBytes(32).toString('base64url');
await writeFile(
  '.env.admin.local',
  `IDENTITY_BOOTSTRAP_ENABLED=true\nADMIN_EMAIL=${email}\nADMIN_PASSWORD=${password}\nADMIN_FIRST_NAME=Local\nADMIN_LAST_NAME=Administrator\n`,
  { mode: 0o600, flag: 'wx' },
);
console.log(
  'Local bootstrap input created in ignored .env.admin.local. Credentials were not printed. Existing files are never overwritten.',
);
