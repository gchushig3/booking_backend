import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  writeFile,
  unlink,
  rm,
  realpath,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { format } from 'prettier';

// Local verification only. No credentials, full process environment or tokens enter evidence.
const npm = process.env.npm_execpath;
assert(npm, 'Run with npm run verify:local.');
const local = parseEnv(await readFile('.env', 'utf8'));
const test = parseEnv(await readFile('.env.test', 'utf8'));
assert.equal(local.APP_ENV, 'local');
assert.equal(local.DB_DATABASE, 'ms_identity');
assert.equal(local.DB_PORT, '5441');
assert.equal(test.APP_ENV, 'test');
assert.equal(test.NODE_ENV, 'test');
assert.equal(test.DB_DATABASE, 'ms_identity_test');
assert.equal(test.DB_PORT, '5442');
for (const env of [local, test]) assert.equal(env.DB_HOST, '127.0.0.1');
const parent = await realpath(tmpdir());
const temporary = await mkdtemp(join(parent, 'identity-verification-'));
const saved = new Map();
const checks = [];
const details = {};
const evidence = {
  phase: 'G',
  started_at_utc: new Date().toISOString(),
  node: process.version,
  checks,
  details,
  status: 'running',
};
const artifacts = [
  'docs/fase-e-evidence.json',
  'docs/fase-f-evidence.json',
  'docs/fase-f-browser-evidence.json',
];
async function run(name, executable, args, capture = false) {
  console.log(`[G] ${name}`);
  const started = Date.now();
  let output = '';
  const code = await new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      windowsHide: true,
      stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit'],
    });
    if (capture)
      child.stdout.on('data', (chunk) => {
        output += chunk.toString();
      });
    child.on('error', reject);
    child.on('close', resolve);
  });
  checks.push({
    name,
    status: code === 0 ? 'passed' : 'failed',
    exit_code: code,
    duration_ms: Date.now() - started,
  });
  assert.equal(code, 0, `${name} failed.`);
  return output.trim();
}
const npmRun = (name, ...args) =>
  run(name, process.execPath, [
    npm,
    'run',
    name,
    ...(args.length ? ['--', ...args] : []),
  ]);
const docker = (name, ...args) => run(name, 'docker', args, true);
async function snapshot(env) {
  const client = new pg.Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
  });
  await client.connect();
  try {
    return (
      await client.query(
        "SELECT json_build_object('database',current_database(),'version',current_setting('server_version_num')::int,'users',(SELECT count(*) FROM usuario),'sessions',(SELECT count(*) FROM sesion),'tokens',(SELECT count(*) FROM token_verificacion),'assignments',(SELECT count(*) FROM usuario_rol),'roles',(SELECT count(*) FROM rol),'active_roles',(SELECT count(*) FROM rol WHERE rol_activo),'admin_assignments',(SELECT count(*) FROM usuario_rol ur JOIN rol r USING(rol_id) WHERE r.rol_nombre='ADMIN'),'tables',(SELECT count(*) FROM pg_tables WHERE schemaname='public'),'domains',(SELECT count(*) FROM information_schema.domains WHERE domain_schema='public'),'view',to_regclass('public.v_usuario_roles') IS NOT NULL) AS state",
      )
    ).rows[0].state;
  } finally {
    await client.end();
  }
}
async function waitReady() {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${local.PORT}/api/v2/health/ready`,
        { signal: AbortSignal.timeout(3000) },
      );
      if (response.status === 200) return;
    } catch {}
    await delay(500);
  }
  throw new Error('Identity readiness timed out.');
}
try {
  for (const file of artifacts) {
    try {
      saved.set(file, await readFile(file));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      saved.set(file, null);
    }
  }
  await docker('compose-config', 'compose', 'config', '--quiet');
  await docker(
    'test-compose-config',
    'compose',
    '--env-file',
    '.env.test',
    '-f',
    'compose.test.yaml',
    'config',
    '--quiet',
  );
  const before = { local: await snapshot(local), test: await snapshot(test) };
  details.database_before = before;
  for (const state of Object.values(before)) {
    assert.equal(
      state.admin_assignments,
      0,
      'Fixture bootstrap tests require no existing ADMIN; existing accounts are never removed.',
    );
    assert.equal(state.roles, 3);
    assert.equal(state.active_roles, 3);
    assert.equal(state.tables, 5);
    assert.equal(state.domains, 3);
    assert.equal(state.view, true);
    assert(state.version >= 160000 && state.version < 170000);
  }
  assert.equal(
    before.test.users,
    0,
    'Test database must not contain existing user data.',
  );
  const sqlHash = createHash('sha256')
    .update(await readFile('database/migrations/001-identity.sql'))
    .digest('hex');
  assert.equal(
    sqlHash,
    '84fa0e694dece975a098b4d22b725b589fb94fe0f071d8f4872740a2ddedb204',
  );
  details.schema_sha256 = sqlHash;
  await npmRun('lint');
  await npmRun('typecheck');
  await npmRun('build');
  await npmRun('format:check');
  await npmRun('openapi:check');
  for (const [script, file] of [
    ['test', 'unit.json'],
    ['test:e2e', 'e2e.json'],
    ['test:integration', 'integration.json'],
  ]) {
    const resultFile = join(temporary, file);
    await run(script, process.execPath, [
      npm,
      'run',
      script,
      '--',
      '--json',
      `--outputFile=${resultFile}`,
    ]);
    const result = JSON.parse(await readFile(resultFile, 'utf8'));
    assert.equal(result.success, true);
    assert.equal(result.numFailedTests, 0);
    assert.equal(result.numPendingTests, 0);
    checks.at(-1).jest = {
      tests: result.numTotalTests,
      passed: result.numPassedTests,
      suites: result.numTotalTestSuites,
    };
  }
  await npmRun('test:docker-bootstrap');
  await docker('compose-build', 'compose', 'up', '-d', '--build', '--wait');
  await waitReady();
  const container = (
    await docker('identity-container', 'compose', 'ps', '-q', 'app')
  ).trim();
  assert(container);
  const info = JSON.parse(
    await docker(
      'runtime-properties',
      'inspect',
      '--format',
      '{{json .Config.User}}|{{json .HostConfig.ReadonlyRootfs}}|{{json .Image}}',
      container,
    ).then((value) =>
      JSON.stringify(value.split('|').map((part) => JSON.parse(part))),
    ),
  );
  assert.equal(info[0], 'node');
  assert.equal(info[1], true);
  details.container = {
    user: info[0],
    read_only_rootfs: info[1],
    image: info[2],
  };
  await npmRun('test:local-stack');
  details.swagger_http = JSON.parse(
    await readFile('docs/fase-f-evidence.json', 'utf8'),
  );
  await run('authorization-docker-flow', process.execPath, [
    'scripts/verify-phase-e.mjs',
  ]);
  details.authorization = JSON.parse(
    await readFile('docs/fase-e-evidence.json', 'utf8'),
  );
  // Each smoke uses normal rate limits. Independent app lifecycles avoid accumulating
  // fixture login attempts across separate scenarios; no limits or guards are disabled.
  const jwksBefore = await (
    await fetch(`http://127.0.0.1:${local.PORT}/api/v2/.well-known/jwks.json`)
  ).json();
  await docker('restart-app', 'compose', 'restart', 'app');
  await waitReady();
  assert.deepEqual(
    await (
      await fetch(`http://127.0.0.1:${local.PORT}/api/v2/.well-known/jwks.json`)
    ).json(),
    jwksBefore,
  );
  details.persisted_public_keys_after_restart = true;
  await npmRun('test:swagger-browser');
  details.swagger_browser = JSON.parse(
    await readFile('docs/fase-f-browser-evidence.json', 'utf8'),
  );
  await docker(
    'restart-local-stack',
    'compose',
    'restart',
    'postgres',
    'mailpit',
    'app',
  );
  await waitReady();
  const after = { local: await snapshot(local), test: await snapshot(test) };
  assert.deepEqual(after, before);
  details.database_after = after;
  details.database_preserved_after_restart = true;
  const productionAudit = await run(
    'audit-production',
    process.execPath,
    [npm, 'audit', '--omit=dev', '--json'],
    true,
  );
  const audit = JSON.parse(productionAudit);
  assert.equal(audit.metadata.vulnerabilities.total, 0);
  details.production_vulnerabilities = audit.metadata.vulnerabilities;
  evidence.status = 'passed';
  evidence.total_tests = checks.reduce(
    (sum, check) => sum + (check.jest?.passed ?? 0),
    0,
  );
} catch (error) {
  evidence.status = 'failed';
  evidence.failure =
    error instanceof assert.AssertionError
      ? 'Verification assertion failed; inspect the last check.'
      : 'Local verification failed; inspect the last check.';
  process.exitCode = 1;
  console.error(evidence.failure);
} finally {
  for (const [file, content] of saved) {
    if (content) await writeFile(file, content);
    else
      await unlink(file).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
  }
  evidence.finished_at_utc = new Date().toISOString();
  await writeFile(
    'docs/fase-g-evidence.json',
    await format(JSON.stringify(evidence), { parser: 'json' }),
  );
  const finalPath = await realpath(temporary);
  if (
    dirname(finalPath) !== parent ||
    !basename(finalPath).startsWith('identity-verification-')
  )
    throw new Error('Unexpected verification cleanup path');
  await rm(finalPath, { recursive: true, force: true });
}
console.log(`[G] ${evidence.status}; evidence: docs/fase-g-evidence.json`);
