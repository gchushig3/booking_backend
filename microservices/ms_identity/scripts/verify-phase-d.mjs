import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { format } from 'prettier';
const env = parseEnv(await readFile('.env', 'utf8'));
assert.equal(env.APP_ENV, 'local');
assert.equal(env.DB_DATABASE, 'ms_identity');
assert.equal(env.DB_HOST, '127.0.0.1');
function docker(args) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    timeout: 30000,
  });
  if (result.error || result.status !== 0)
    throw new Error(`Docker ${args[0]} failed`);
  return result.stdout.trim();
}
const app = docker(['compose', 'ps', '-q', 'app']);
assert(app);
const inspect = (field) =>
  JSON.parse(docker(['inspect', '--format', `{{json .${field}}}`, app]));
assert.equal(
  inspect('Config.Labels')['com.docker.compose.project'],
  'ms-identity',
);
assert.equal(
  resolve(inspect('Config.Labels')['com.docker.compose.project.working_dir']),
  resolve('.'),
);
assert.equal(inspect('Config.User'), 'node');
assert.equal(inspect('HostConfig.ReadonlyRootfs'), true);
const keyMount = inspect('Mounts').find(
  (m) => m.Destination === '/run/identity-keys',
);
assert(keyMount && keyMount.RW === false);
const client = new pg.Client({
  host: env.DB_HOST,
  port: Number(env.DB_PORT),
  user: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_DATABASE,
});
await client.connect();
const base = `http://127.0.0.1:${env.PORT}`;
const mailBase = `http://127.0.0.1:${env.MAILPIT_UI_PORT ?? 8025}`;
const email = `phase-d-${randomUUID()}@example.test`;
const password = randomBytes(24).toString('base64url');
const mailIds = new Set();
let userId;
async function http(path, status = 200, body, token) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-Id': 'cid-identity-phase-d',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, status, path);
  assert.equal(
    response.headers.get('x-correlation-id'),
    'cid-identity-phase-d',
  );
  return response.status === 204 ? undefined : response.json();
}
async function snapshot() {
  return (
    await client.query(
      "SELECT json_build_object('database',current_database(),'version',current_setting('server_version'),'tables',(SELECT count(*) FROM pg_tables WHERE schemaname='public'),'domains',(SELECT count(*) FROM information_schema.domains WHERE domain_schema='public'),'roles',(SELECT count(*) FROM rol),'users',(SELECT count(*) FROM usuario),'view',to_regclass('public.v_usuario_roles') IS NOT NULL) AS state",
    )
  ).rows[0].state;
}
const before = await snapshot();
assert.equal(before.tables, 5);
assert.equal(before.domains, 3);
assert.equal(before.roles, 3);
assert.equal(before.view, true);
let evidence;
try {
  await http('/api/v2/health/ready');
  await http('/api/v2/auth/me', 401);
  const jwks = await http('/api/v2/.well-known/jwks.json');
  for (const key of jwks.keys) {
    assert(!key.d && !key.p);
    assert.equal(key.alg, 'RS256');
  }
  const registration = await http('/api/v2/auth/register', 201, {
    email,
    password,
    first_name: 'Docker',
    last_name: 'Phase D fixture',
  });
  userId = registration.user.id;
  assert.equal(typeof userId, 'string');
  assert.equal(registration.verification_email_sent, true);
  assert.deepEqual(registration.user.roles, ['CLIENTE']);
  const tokens = await http('/api/v2/auth/login', 200, { email, password });
  assert.equal(
    (await http('/api/v2/auth/me', 200, undefined, tokens.access_token)).user
      .id,
    userId,
  );
  const messages = (
    await (await fetch(`${mailBase}/api/v1/messages?limit=1000`)).json()
  ).messages.filter((m) => m.To.some((to) => to.Address === email));
  for (const m of messages) mailIds.add(m.ID);
  assert.equal(messages.length, 1);
  const mail = await (
    await fetch(`${mailBase}/api/v1/message/${messages[0].ID}`)
  ).json();
  const verification = /Token: ([A-Za-z0-9_-]{43})/.exec(mail.Text)?.[1];
  assert(verification);
  await http('/api/v2/auth/verify-email', 204, { token: verification });
  const rotated = await http('/api/v2/auth/refresh', 200, {
    refresh_token: tokens.refresh_token,
  });
  assert.notEqual(rotated.refresh_token, tokens.refresh_token);
  docker(['compose', 'restart', 'app']);
  const deadline = Date.now() + 60000;
  while (inspect('State.Health.Status') !== 'healthy') {
    if (Date.now() > deadline) throw new Error('Identity restart timeout');
    await delay(1000);
  }
  assert.deepEqual(await http('/api/v2/.well-known/jwks.json'), jwks);
  assert.equal(
    (await http('/api/v2/auth/me', 200, undefined, rotated.access_token)).user
      .verified,
    true,
  );
  await http('/api/v2/auth/logout', 204, {}, rotated.access_token);
  await http('/api/v2/auth/me', 401, undefined, rotated.access_token);
  evidence = {
    checked_at_utc: new Date().toISOString(),
    phase: 'D',
    base_url: base,
    app_image: inspect('Image'),
    node_runtime: docker(['exec', app, 'node', '--version']),
    postgres_before: before,
    public_registration: true,
    login_without_access_jwt: true,
    default_client_only: true,
    real_smtp_verification: true,
    refresh_rotation: true,
    logout_revokes_access: true,
    jwks_public_only: true,
    persisted_keys_and_sessions_after_restart: true,
    non_root: true,
    read_only_rootfs: true,
    read_only_key_mount: true,
    authentication_implemented: true,
    admin_bootstrap_implemented: false,
    swagger_implemented: false,
  };
} finally {
  if (userId)
    await client.query(
      'DELETE FROM usuario WHERE usu_id=$1::bigint AND usu_correo=$2',
      [userId, email],
    );
  if (mailIds.size) {
    const response = await fetch(`${mailBase}/api/v1/messages`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ IDs: [...mailIds] }),
    });
    assert([200, 204].includes(response.status));
  }
  const after = await snapshot();
  await client.end();
  assert.deepEqual(after, before);
  if (evidence) {
    evidence.postgres_after = after;
    evidence.fixtures_removed = true;
    await writeFile(
      'docs/fase-d-evidence.json',
      await format(JSON.stringify(evidence), { parser: 'json' }),
    );
  }
}
console.log(
  'PASS: real Docker authentication, SMTP verification, refresh/logout and restart. Only this run fixtures were removed; no tokens printed.',
);
