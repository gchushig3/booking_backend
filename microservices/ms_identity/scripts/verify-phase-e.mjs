import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
const env = parseEnv(await readFile('.env', 'utf8'));
assert.equal(env.APP_ENV, 'local');
assert.equal(env.DB_HOST, '127.0.0.1');
assert.equal(env.DB_DATABASE, 'ms_identity');
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
const suffix = randomUUID();
const adminEmail = `phase-e-admin-${suffix}@example.test`;
const userEmail = `phase-e-client-${suffix}@example.test`;
const password = randomBytes(32).toString('base64url');
const ids = [];
const credentials = `.env.admin.smoke-${suffix}`;
let fileCreated = false;
let evidence;
async function http(method, path, status, body, token) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-Id': 'cid-identity-phase-e',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, status, path);
  assert.equal(
    response.headers.get('x-correlation-id'),
    'cid-identity-phase-e',
  );
  return status === 204 ? undefined : response.json();
}
async function snapshot() {
  return (
    await client.query(
      "SELECT json_build_object('users',(SELECT count(*) FROM usuario),'roles',(SELECT count(*) FROM rol),'tables',(SELECT count(*) FROM pg_tables WHERE schemaname='public'),'domains',(SELECT count(*) FROM information_schema.domains WHERE domain_schema='public')) AS state",
    )
  ).rows[0].state;
}
const before = await snapshot();
try {
  const admins = await client.query(
    "SELECT count(*)::int AS n FROM usuario_rol ur JOIN rol r USING(rol_id) WHERE r.rol_nombre='ADMIN'",
  );
  assert.equal(
    admins.rows[0].n,
    0,
    'Smoke bootstrap requires no existing administrator; existing accounts are never modified.',
  );
  await writeFile(
    credentials,
    `IDENTITY_BOOTSTRAP_ENABLED=true\nADMIN_EMAIL=${adminEmail}\nADMIN_PASSWORD=${password}\nADMIN_FIRST_NAME=Docker\nADMIN_LAST_NAME=Phase E fixture\n`,
    { mode: 0o600, flag: 'wx' },
  );
  fileCreated = true;
  for (let n = 0; n < 2; n++) {
    const result = spawnSync(
      process.execPath,
      [
        '--env-file=.env',
        `--env-file=${credentials}`,
        'scripts/bootstrap-admin.mjs',
      ],
      { encoding: 'utf8', timeout: 15000 },
    );
    assert.equal(
      result.status,
      0,
      'Explicit bootstrap CLI must succeed without printing credentials.',
    );
    assert(!result.stdout.includes(password));
  }
  const admin = (
    await client.query('SELECT usu_id FROM usuario WHERE usu_correo=$1', [
      adminEmail,
    ])
  ).rows[0];
  assert(admin);
  ids.push(admin.usu_id);
  const registered = await http('POST', '/api/v2/auth/register', 201, {
    email: userEmail,
    password,
    first_name: 'Docker',
    last_name: 'Phase E fixture',
  });
  ids.push(registered.user.id);
  const adminTokens = await http('POST', '/api/v2/auth/login', 200, {
    email: adminEmail,
    password,
  });
  const userTokens = await http('POST', '/api/v2/auth/login', 200, {
    email: userEmail,
    password,
  });
  await http('GET', '/api/v2/users', 401);
  await http('GET', '/api/v2/users', 403, undefined, userTokens.access_token);
  await http(
    'GET',
    '/api/v2/users?limit=1',
    200,
    undefined,
    adminTokens.access_token,
  );
  const roles = await http(
    'GET',
    '/api/v2/roles',
    200,
    undefined,
    adminTokens.access_token,
  );
  const operator = roles.find((r) => r.name === 'OPERADOR');
  assert(operator);
  await http(
    'PATCH',
    '/api/v2/users/me',
    200,
    { first_name: 'Profile checked' },
    userTokens.access_token,
  );
  await http(
    'POST',
    `/api/v2/users/${registered.user.id}/roles`,
    201,
    { role_id: operator.id },
    adminTokens.access_token,
  );
  await http(
    'GET',
    '/api/v2/users/me',
    401,
    undefined,
    userTokens.access_token,
  );
  const changed = await http('POST', '/api/v2/auth/login', 200, {
    email: userEmail,
    password,
  });
  await http('GET', '/api/v2/roles', 403, undefined, changed.access_token);
  await http(
    'PATCH',
    `/api/v2/users/${registered.user.id}/status`,
    200,
    { active: false },
    adminTokens.access_token,
  );
  await http('POST', '/api/v2/auth/login', 401, { email: userEmail, password });
  await http(
    'PATCH',
    `/api/v2/users/${admin.usu_id}/status`,
    409,
    { active: false },
    adminTokens.access_token,
  );
  await http('POST', '/api/v2/auth/logout', 204, {}, adminTokens.access_token);
  evidence = {
    checked_at_utc: new Date().toISOString(),
    phase: 'E',
    base_url: base,
    bootstrap_cli_and_idempotence: true,
    admin_login_and_access: true,
    client_denied_admin: true,
    own_profile: true,
    role_change_revokes_sessions: true,
    operator_denied_admin: true,
    deactivation_rejects_login: true,
    self_deactivation_rejected: true,
    postgres_before: before,
  };
} finally {
  // Only this script's email addresses can be deleted, including a fixture created before an HTTP failure.
  await client.query('DELETE FROM usuario WHERE usu_correo=ANY($1::text[])', [
    [adminEmail, userEmail],
  ]);
  const list = await (
    await fetch(`${mailBase}/api/v1/messages?limit=1000`)
  ).json();
  const mails = list.messages
    .filter((m) =>
      m.To.some((t) => [adminEmail, userEmail].includes(t.Address)),
    )
    .map((m) => m.ID);
  if (mails.length)
    await fetch(`${mailBase}/api/v1/messages`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ IDs: mails }),
    });
  if (fileCreated) await unlink(credentials);
  const after = await snapshot();
  await client.end();
  assert.deepEqual(after, before);
  if (evidence) {
    evidence.postgres_after = after;
    evidence.fixtures_removed = true;
    await writeFile(
      'docs/fase-e-evidence.json',
      JSON.stringify(evidence, null, 2) + '\n',
    );
  }
}
console.log(
  'PASS: real local ADMIN bootstrap, JWT/RBAC, profiles, role changes and deactivation. Only this run fixtures were removed; no credentials printed.',
);
