import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { format } from 'prettier';

const phase = process.argv.includes('--phase=h') ? 'h' : 'g';

function docker(args) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    timeout: 30000,
  });
  if (result.error || result.status !== 0) {
    // Do not include command output: Docker configuration may contain credentials.
    throw new Error(
      `Docker command failed (${args[0]}), exit=${result.status}`,
    );
  }
  return result.stdout.trim();
}

function inspect(container, field) {
  return JSON.parse(
    docker(['inspect', '--format', `{{json .${field}}}`, container]),
  );
}

const app = docker(['compose', 'ps', '-q', 'app']);
const postgres = docker(['compose', 'ps', '-q', 'postgres']);
assert(app && postgres, 'Start the Catalog compose stack first');
const labels = inspect(app, 'Config.Labels');
assert.equal(labels['com.docker.compose.project'], 'ms-catalog');
assert.equal(
  resolve(labels['com.docker.compose.project.working_dir']),
  resolve('.'),
);
const config = inspect(app, 'HostConfig');
assert.equal(inspect(app, 'Config.User'), 'node');
assert.equal(config.ReadonlyRootfs, true);
assert(config.CapDrop.includes('ALL'));
assert(config.SecurityOpt.includes('no-new-privileges:true'));
assert.notEqual(docker(['exec', app, 'id', '-u']), '0');
assert.equal(
  docker([
    'exec',
    app,
    'node',
    '-e',
    "const f=require('node:fs');if(f.existsSync('/app/.env')||f.existsSync('/app/.env.test'))process.exit(1);console.log('no-env-files');",
  ]),
  'no-env-files',
);

function query(sql) {
  return docker([
    'exec',
    postgres,
    'sh',
    '-c',
    'exec psql --no-psqlrc -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$1"',
    '--',
    sql,
  ]);
}

function snapshot() {
  return JSON.parse(
    query(`SELECT json_build_object(
    'database',current_database(),
    'version',current_setting('server_version'),
    'tables',(SELECT json_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public'),
    'domains',(SELECT count(*) FROM information_schema.domains WHERE domain_schema='public'),
    'view',to_regclass('public.v_atraccion_completa') IS NOT NULL,
    'operators',(SELECT count(*) FROM operador),
    'attractions',(SELECT count(*) FROM atraccion),
    'categories',(SELECT count(*) FROM categoria),
    'languages',(SELECT count(*) FROM idioma),
    'seed_languages',(SELECT json_agg(idi_codigo ORDER BY idi_codigo) FROM idioma WHERE idi_codigo IN ('es','en','fr','de')),
    'seed_categories',(SELECT json_agg(cat_slug ORDER BY cat_slug) FROM categoria WHERE cat_slug IN ('aventura','cultural','naturales','gastronomia','playas','montana'))
  )`),
  );
}

const port = inspect(app, 'NetworkSettings.Ports')['3014/tcp']?.[0]?.HostPort;
// Determine a custom PORT through exposed bindings without printing environment variables.
const bindings = Object.values(inspect(app, 'NetworkSettings.Ports'))
  .flat()
  .filter(Boolean);
assert.equal(bindings.length, 1);
assert.equal(bindings[0].HostIp, '127.0.0.1');
const base = `http://127.0.0.1:${port ?? bindings[0].HostPort}`;
const before = snapshot();
assert.equal(before.database, 'ms_catalog');
assert.match(before.version, /^16\./);
assert.equal(before.tables.length, 10);
assert.equal(before.domains, 4);
assert.equal(before.view, true);
assert.equal(before.seed_languages.length, 4);
assert.equal(before.seed_categories.length, 6);

async function get(path, status = 200, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, status, `${options.method ?? 'GET'} ${path}`);
  return response;
}

async function verifyHttp() {
  assert.deepEqual(await (await get('/api/v2/health/live')).json(), {
    status: 'UP',
  });
  const ui = await get('/api/docs');
  assert.match(await ui.text(), /swagger-ui/);
  await get('/api/docs/swagger-ui-bundle.js');
  const yaml = await (await get('/api/docs-yaml')).text();
  assert.equal(
    yaml,
    await readFile(new URL('../docs/openapi.yaml', import.meta.url), 'utf8'),
  );
  const spec = await (await get('/api/docs-json')).json();
  assert.match(spec.openapi, /^3\.0\./);
  for (const path of [
    '/api/v2/atracciones',
    '/api/v2/atracciones/categorias',
    '/api/v2/atracciones/categorias/arbol',
    '/api/v2/idiomas',
    '/api/v2/inclusiones',
  ]) {
    const response = await get(path, 200, {
      headers: { 'X-Correlation-Id': 'cid-docker-phase-g' },
    });
    assert.equal(
      response.headers.get('x-correlation-id'),
      'cid-docker-phase-g',
    );
    await response.json();
  }
  await get('/api/v2/atracciones/search', 200, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const missing = await get(
    `/api/v2/atracciones/phase-g-absent-${randomUUID()}`,
    404,
  );
  assert.match(
    missing.headers.get('content-type'),
    /application\/problem\+json/,
  );
  assert.equal((await missing.json()).code, 'ATTRACTION_NOT_FOUND');
  const outOfRange = await get('/api/v2/atracciones/9223372036854775808', 404);
  assert.equal((await outOfRange.json()).code, 'ATTRACTION_NOT_FOUND');
  for (const query of ['featured=invalid', 'city_id=invalid']) {
    const response = await get(`/api/v2/atracciones?${query}`, 400);
    assert.equal((await response.json()).code, 'VALIDATION_ERROR');
  }
  for (const body of [{ featured: 'invalid' }, { city_id: 'invalid' }]) {
    const response = await get('/api/v2/atracciones/search', 400, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal((await response.json()).code, 'VALIDATION_ERROR');
  }
  let protectedOperations = 0;
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      if (!item[method]?.['x-admin-blocked']) continue;
      protectedOperations++;
      const response = await get(path.replace(/\{\w+\}/g, '1'), 401, {
        method: method.toUpperCase(),
        headers: { Authorization: 'Bearer phase-g-invalid' },
      });
      assert.match(
        response.headers.get('content-type'),
        /application\/problem\+json/,
      );
      assert.equal((await response.json()).code, 'AUTHENTICATION_UNAVAILABLE');
    }
  }
  assert.equal(protectedOperations, 30);
}

async function waitHealthy(container) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (inspect(container, 'State.Health.Status') === 'healthy') return;
    await delay(1000);
  }
  throw new Error('Catalog container did not become healthy after restart');
}

await verifyHttp();
console.log(
  'PASS: real Docker HTTP, Swagger, public queries and 30 protected operations.',
);
const mountsBefore = inspect(postgres, 'Mounts')
  .filter((mount) => mount.Type === 'volume')
  .map((mount) => mount.Name);
assert.equal(mountsBefore.length, 1);
// Restart only this verified Compose project, without removing any volume or inserting fixtures.
docker(['compose', 'restart', 'postgres', 'app']);
await waitHealthy(postgres);
await waitHealthy(app);
await verifyHttp();
const after = snapshot();
assert.deepEqual(after, before);
const mountsAfter = inspect(postgres, 'Mounts')
  .filter((mount) => mount.Type === 'volume')
  .map((mount) => mount.Name);
assert.deepEqual(mountsAfter, mountsBefore);
console.log(
  'PASS: PostgreSQL and application restart preserve data and the original volume.',
);
const evidence = {
  phase: phase.toUpperCase(),
  checked_at_utc: new Date().toISOString(),
  base_url: base,
  docker_server: docker(['version', '--format', '{{.Server.Version}}']),
  compose: docker(['compose', 'version', '--short']),
  app_node: docker(['exec', app, 'node', '--version']),
  app_image: inspect(app, 'Image'),
  non_root: true,
  read_only_rootfs: true,
  dropped_capabilities: ['ALL'],
  no_new_privileges: true,
  no_env_files_in_image: true,
  postgres_before: before,
  postgres_after: after,
  persistent_volume: mountsAfter[0],
  swagger_matches_export: true,
  protected_http_operations_checked: 30,
  invalid_optional_filters_checked: 4,
  http_verified_before_and_after_restart: true,
  containers_left_running: true,
};
await writeFile(
  new URL(`../docs/fase-${phase}-evidence.json`, import.meta.url),
  await format(JSON.stringify(evidence), { parser: 'json' }),
);
console.log(
  `Evidence saved without credentials: docs/fase-${phase}-evidence.json`,
);
