import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const temporaryParent = await realpath(tmpdir());
const temporary = await mkdtemp(join(temporaryParent, 'identity-bootstrap-'));
const created = [];
const password = randomBytes(32).toString('hex');
const user = 'identity_bootstrap_test';
const database = 'ms_identity_test';

function docker(args, allowFailure = false) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    timeout: 20000,
    env: { ...process.env, POSTGRES_PASSWORD: password },
  });
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error(
      `Docker verification failed: ${result.error?.message ?? result.stderr}`,
    );
  }
  return result;
}

async function until(check) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const result = check();
    if (result !== undefined) return result;
    await delay(500);
  }
  throw new Error('Docker verification timed out');
}

function query(container, sql) {
  return docker(
    ['exec', container, 'psql', '-U', user, '-d', database, '-Atc', sql],
    true,
  );
}

async function waitTables(container, expected) {
  return until(() => {
    const result = query(
      container,
      "SELECT count(*) FROM pg_tables WHERE schemaname='public'",
    );
    return result.status === 0 && result.stdout.trim() === String(expected)
      ? true
      : undefined;
  });
}

async function start(migrationDirectory) {
  const name = `ms-identity-bootstrap-${randomUUID()}`;
  created.push(name);
  docker([
    'run',
    '-d',
    '--name',
    name,
    '--network',
    'none',
    '--label',
    'descubreec.test=identity-bootstrap',
    '--env',
    'POSTGRES_PASSWORD',
    '--env',
    `POSTGRES_USER=${user}`,
    '--env',
    `POSTGRES_DB=${database}`,
    '--mount',
    `type=bind,source=${migrationDirectory},target=/identity-schema,readonly`,
    '--mount',
    `type=bind,source=${resolve(root, 'database/docker-init.sh')},target=/docker-entrypoint-initdb.d/010-identity.sh,readonly`,
    'postgres:16-bookworm',
  ]);
  return name;
}

try {
  const successful = await start(resolve(root, 'database/migrations'));
  await waitTables(successful, 5);
  let seeds = query(
    successful,
    'SELECT (SELECT count(*) FROM rol), (SELECT count(*) FROM usuario)',
  );
  assert.equal(seeds.status, 0);
  assert.equal(seeds.stdout.trim(), '3|0');
  docker(['restart', successful]);
  await waitTables(successful, 5);
  seeds = query(
    successful,
    'SELECT (SELECT count(*) FROM rol), (SELECT count(*) FROM usuario)',
  );
  assert.equal(seeds.stdout.trim(), '3|0');
  console.log(
    'PASS: Docker bootstrap creates five tables and preserves original seeds after restart.',
  );

  // Fixture de fallo en un directorio temporal: jamás altera el SQL aprobado.
  const failingSql =
    (await readFile(
      resolve(root, 'database/migrations/001-identity.sql'),
      'utf8',
    )) + '\nSELECT 1 / 0;\n';
  await writeFile(join(temporary, '001-identity.sql'), failingSql);
  await writeFile(
    join(temporary, 'SHA256SUMS'),
    `${createHash('sha256').update(failingSql).digest('hex')}  001-identity.sql\n`,
  );
  const failed = await start(temporary);
  await until(() => {
    const state = docker([
      'inspect',
      failed,
      '--format',
      '{{.State.Running}} {{.State.ExitCode}}',
    ]).stdout.trim();
    return /^false [1-9][0-9]*$/.test(state) ? true : undefined;
  });
  // PGDATA inicializado: al reiniciar se abre sin volver a aplicar initdb scripts.
  docker(['start', failed]);
  await waitTables(failed, 0);
  const domains = query(
    failed,
    "SELECT count(*) FROM information_schema.domains WHERE domain_schema='public'",
  );
  assert.equal(domains.stdout.trim(), '0');
  console.log(
    'PASS: injected SQL failure rolls back all Identity tables and domains.',
  );
} finally {
  for (const name of created) {
    docker(['rm', '--force', '--volumes', name], true);
  }
  // temporary fue creado por mkdtemp dentro de os.tmpdir para estas fixtures.
  const finalTemporary = await realpath(temporary);
  if (
    dirname(finalTemporary) !== temporaryParent ||
    !basename(finalTemporary).startsWith('identity-bootstrap-')
  ) {
    throw new Error(
      'Refusing cleanup outside the verified temporary directory',
    );
  }
  await rm(finalTemporary, { recursive: true, force: true });
}
