import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const test = process.argv.includes('--test');
const fileName = test ? '.env.test' : '.env';
const target = new URL(`../${fileName}`, import.meta.url);
const contents = [
  `NODE_ENV=${test ? 'test' : 'development'}`,
  'PORT=3014',
  'DB_HOST=127.0.0.1',
  `DB_PORT=${test ? '5445' : '5444'}`,
  `DB_USERNAME=${test ? 'catalog_test_local' : 'catalog_local'}`,
  `DB_PASSWORD=${randomBytes(32).toString('hex')}`,
  `DB_DATABASE=${test ? 'ms_catalog_test' : 'ms_catalog'}`,
  '',
].join('\n');

try {
  await writeFile(target, contents, { flag: 'wx', mode: 0o600 });
  console.log(`${fileName} local creado; contraseña aleatoria no mostrada.`);
} catch (error) {
  if (error.code === 'EEXIST') {
    console.log(`${fileName} ya existe; se conserva sin cambios.`);
  } else {
    throw error;
  }
}
