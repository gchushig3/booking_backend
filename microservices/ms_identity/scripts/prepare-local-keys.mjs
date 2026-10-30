import { generateKeyPairSync, randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  open,
  unlink,
} from 'node:fs/promises';
import { parseEnv } from 'node:util';

const test = process.argv.includes('--test');
const rotate = process.argv.includes('--rotate');
const env = parseEnv(
  await readFile(
    new URL(test ? '../.env.test' : '../.env', import.meta.url),
    'utf8',
  ),
);
if (env.APP_ENV !== (test ? 'test' : 'local'))
  throw new Error(
    'Key generation allowed only for an explicitly local/test environment',
  );
const directory = new URL('../.keys/', import.meta.url);
await mkdir(directory, { recursive: true, mode: 0o700 });
const target = new URL(
  test ? 'identity.test.json' : 'identity.local.json',
  directory,
);
const lock = new URL(
  test ? 'identity.test.lock' : 'identity.local.lock',
  directory,
);
const handle = await open(lock, 'wx', 0o600);
try {
  let previous;
  try {
    previous = JSON.parse(await readFile(target, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (previous && !rotate) {
    console.log(
      'Local RSA keyring already exists; preserved without printing private keys.',
    );
  } else {
    const pair = generateKeyPairSync('rsa', { modulusLength: 3072 });
    const kid = randomUUID();
    const entry = {
      kid,
      created_at: new Date().toISOString(),
      privateJwk: pair.privateKey.export({ format: 'jwk' }),
      publicJwk: {
        ...pair.publicKey.export({ format: 'jwk' }),
        kid,
        alg: 'RS256',
        use: 'sig',
      },
    };
    const retained = (previous?.keys ?? []).map(
      ({ kid, created_at, publicJwk }) => ({ kid, created_at, publicJwk }),
    );
    const next = { activeKid: kid, keys: [...retained, entry] };
    const temporary = new URL(`keyring-${randomUUID()}.tmp`, directory);
    await writeFile(temporary, JSON.stringify(next, null, 2) + '\n', {
      mode: 0o600,
      flag: 'wx',
    });
    await rename(temporary, target);
    console.log(
      'RSA keyring prepared; private material not printed. Restart Identity after rotation.',
    );
  }
} finally {
  await handle.close();
  await unlink(lock);
}
