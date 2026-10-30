import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { format } from 'prettier';

function docker(args) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    timeout: 30000,
  });
  if (result.error || result.status !== 0)
    throw new Error(`Docker ${args[0]} failed; exit=${result.status}`);
  return result.stdout.trim();
}
function inspect(container, field) {
  return JSON.parse(
    docker(['inspect', '--format', `{{json .${field}}}`, container]),
  );
}
const containers = Object.fromEntries(
  ['app', 'postgres', 'mailpit'].map((service) => [
    service,
    docker(['compose', 'ps', '-q', service]),
  ]),
);
for (const container of Object.values(containers))
  assert(container, 'Start Identity Compose first');
const labels = inspect(containers.app, 'Config.Labels');
assert.equal(labels['com.docker.compose.project'], 'ms-identity');
assert.equal(
  resolve(labels['com.docker.compose.project.working_dir']),
  resolve('.'),
);
assert.equal(inspect(containers.app, 'Config.User'), 'node');
assert.equal(inspect(containers.app, 'HostConfig.ReadonlyRootfs'), true);
assert.notEqual(docker(['exec', containers.app, 'id', '-u']), '0');

function binding(container, port) {
  const value = inspect(container, 'NetworkSettings.Ports')[`${port}/tcp`]?.[0];
  assert(value);
  assert.equal(value.HostIp, '127.0.0.1');
  return Number(value.HostPort);
}
const appBindings = Object.values(
  inspect(containers.app, 'NetworkSettings.Ports'),
)
  .flat()
  .filter(Boolean);
assert.equal(appBindings.length, 1);
assert.equal(appBindings[0].HostIp, '127.0.0.1');
const base = `http://127.0.0.1:${appBindings[0].HostPort}`;
const mailBase = `http://127.0.0.1:${binding(containers.mailpit, 8025)}`;
const smtpPort = binding(containers.mailpit, 1025);

function snapshot() {
  const sql = `SELECT json_build_object('database',current_database(),'version',current_setting('server_version'),'tables',(SELECT count(*) FROM pg_tables WHERE schemaname='public'),'domains',(SELECT count(*) FROM information_schema.domains WHERE domain_schema='public'))`;
  return JSON.parse(
    docker([
      'exec',
      containers.postgres,
      'sh',
      '-c',
      'exec psql --no-psqlrc -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$1"',
      '--',
      sql,
    ]),
  );
}
async function http(path, expected = 200, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, expected, path);
  return response;
}
async function verifyHttp() {
  for (const name of ['live', 'ready']) {
    const response = await http(`/api/v2/health/${name}`, 200, {
      headers: { 'X-Correlation-Id': 'cid-identity-phase-b' },
    });
    assert.deepEqual(await response.json(), { status: 'UP' });
    assert.equal(
      response.headers.get('x-correlation-id'),
      'cid-identity-phase-b',
    );
  }
  const missing = await http('/api/v2/auth/login', 404, { method: 'POST' });
  assert.match(
    missing.headers.get('content-type'),
    /application\/problem\+json/,
  );
  assert.equal((await missing.json()).code, 'NOT_FOUND');
  await http('/api/docs', 404);
  const mail = await fetch(mailBase, { signal: AbortSignal.timeout(10000) });
  assert.equal(mail.status, 200);
  assert.match(await mail.text(), /mailpit/i);
}

async function verifySmtp() {
  const subject = `Identity phase B infrastructure fixture ${randomUUID()}`;
  const socket = createConnection({ host: '127.0.0.1', port: smtpPort });
  const lines = createInterface({ input: socket, crlfDelay: Infinity });
  const iterator = lines[Symbol.asyncIterator]();
  socket.setTimeout(10000, () => socket.destroy(new Error('SMTP timeout')));
  socket.on('error', () => {});
  async function response(expected) {
    let line;
    do {
      const next = await iterator.next();
      if (next.done) throw new Error('SMTP connection closed');
      line = next.value;
    } while (line[3] !== ' ');
    assert.equal(Number(line.slice(0, 3)), expected);
  }
  async function command(value, expected) {
    socket.write(value + '\r\n');
    await response(expected);
  }
  try {
    await response(220);
    await command('EHLO identity.local', 250);
    await command('MAIL FROM:<noreply@identity.local>', 250);
    await command('RCPT TO:<phase-b-fixture@identity.local>', 250);
    await command('DATA', 354);
    await command(
      `From: noreply@identity.local\r\nTo: phase-b-fixture@identity.local\r\nSubject: ${subject}\r\nDate: ${new Date().toUTCString()}\r\nMessage-ID: <${randomUUID()}@identity.local>\r\n\r\nInfrastructure test only. No authentication token.\r\n.`,
      250,
    );
    await command('QUIT', 221);
  } finally {
    lines.close();
    socket.destroy();
  }
  const list = await fetch(`${mailBase}/api/v1/messages`, {
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(list.status, 200);
  const message = (await list.json()).messages.find(
    (message) => message.Subject === subject,
  );
  assert(message?.ID, 'SMTP fixture must be captured by Mailpit');
  // Delete exclusively the message created by this test, never clear the inbox.
  const removed = await fetch(`${mailBase}/api/v1/messages`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ IDs: [message.ID] }),
    signal: AbortSignal.timeout(10000),
  });
  assert([200, 204].includes(removed.status));
}

const before = snapshot();
assert.equal(before.database, 'ms_identity');
assert.match(before.version, /^16\./);
assert.equal(before.tables, 0, 'Phase B must not initialize phase C tables');
assert.equal(before.domains, 0);
await verifyHttp();
await verifySmtp();
console.log(
  'PASS: real Nest/PostgreSQL readiness, Mailpit UI and SMTP capture; fixture removed.',
);
const volumes = inspect(containers.postgres, 'Mounts')
  .filter((mount) => mount.Type === 'volume')
  .map((mount) => mount.Name);
docker(['compose', 'restart', 'postgres', 'mailpit', 'app']);
for (const container of Object.values(containers)) {
  const deadline = Date.now() + 90000;
  while (inspect(container, 'State.Health.Status') !== 'healthy') {
    if (Date.now() > deadline)
      throw new Error('Identity healthcheck timed out');
    await delay(1000);
  }
}
await verifyHttp();
const after = snapshot();
assert.deepEqual(before, after);
assert.deepEqual(
  inspect(containers.postgres, 'Mounts')
    .filter((mount) => mount.Type === 'volume')
    .map((mount) => mount.Name),
  volumes,
);
const evidence = {
  checked_at_utc: new Date().toISOString(),
  phase: 'B',
  base_url: base,
  mailpit_url: mailBase,
  app_image: inspect(containers.app, 'Image'),
  node_runtime: docker(['exec', containers.app, 'node', '--version']),
  postgres_before: before,
  postgres_after: after,
  persistent_volumes: volumes,
  health_http: true,
  smtp_capture_and_fixture_cleanup: true,
  restart_verified: true,
  non_root: true,
  read_only_rootfs: true,
  schema_not_initialized: true,
  authentication_implemented: false,
  containers_left_running: true,
};
await writeFile(
  new URL('../docs/fase-b-evidence.json', import.meta.url),
  await format(JSON.stringify(evidence), { parser: 'json' }),
);
console.log(
  'PASS: restart preserves the original volume; no phase C schema created.',
);
