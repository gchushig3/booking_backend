import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
describe('Explicit local bootstrap credential preparation', () => {
  let directory: string;
  const script = fileURLToPath(
    new URL('../../scripts/prepare-admin.mjs', import.meta.url),
  );
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'identity-bootstrap-'));
    await writeFile(
      join(directory, '.env'),
      'APP_ENV=local\nDB_DATABASE=ms_identity\nDB_HOST=127.0.0.1\n',
    );
  });
  afterAll(async () => {
    if (directory) {
      if (
        dirname(resolve(directory)) !== resolve(tmpdir()) ||
        !basename(directory).startsWith('identity-bootstrap-')
      )
        throw new Error('Unexpected cleanup path');
      await rm(directory, { recursive: true });
    }
  });
  it('generates a private file with random credentials, without printing the password', async () => {
    const result = spawnSync(
      process.execPath,
      [script, '--email', 'Administrator@example.test'],
      { cwd: directory, encoding: 'utf8' },
    );
    expect(result.status).toBe(0);
    const env = parseEnv(
      await readFile(join(directory, '.env.admin.local'), 'utf8'),
    );
    expect(env.ADMIN_EMAIL).toBe('administrator@example.test');
    expect(env.ADMIN_PASSWORD?.length).toBe(43);
    expect(env.IDENTITY_BOOTSTRAP_ENABLED).toBe('true');
    expect(result.stdout.includes(env.ADMIN_PASSWORD!)).toBe(false);
  });
  it('never overwrites existing bootstrap credentials', async () => {
    const before = await readFile(join(directory, '.env.admin.local'), 'utf8');
    const result = spawnSync(
      process.execPath,
      [script, '--email', 'other@example.test'],
      { cwd: directory, encoding: 'utf8' },
    );
    expect(result.status).not.toBe(0);
    expect(
      (await readFile(join(directory, '.env.admin.local'), 'utf8')) === before,
    ).toBe(true);
  });
  it('rejects production configuration before generating credentials', async () => {
    await writeFile(
      join(directory, '.env'),
      'APP_ENV=production\nDB_DATABASE=ms_identity\nDB_HOST=127.0.0.1\n',
    );
    const before = await readFile(join(directory, '.env.admin.local'), 'utf8');
    const result = spawnSync(
      process.execPath,
      [script, '--email', 'other@example.test'],
      { cwd: directory, encoding: 'utf8' },
    );
    expect(result.status).not.toBe(0);
    expect(
      (await readFile(join(directory, '.env.admin.local'), 'utf8')) === before,
    ).toBe(true);
  });
});
