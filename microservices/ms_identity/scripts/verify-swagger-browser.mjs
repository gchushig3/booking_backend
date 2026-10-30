import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  writeFile,
  unlink,
  rm,
  access,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { parseEnv } from 'node:util';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
const env = parseEnv(await readFile('.env', 'utf8'));
assert.equal(env.APP_ENV, 'local');
assert.equal(env.DB_HOST, '127.0.0.1');
assert.equal(env.DB_DATABASE, 'ms_identity');
const chrome =
  process.env.CHROME_PATH ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
await access(chrome);
const directory = await mkdtemp(join(tmpdir(), 'identity-swagger-'));
const suffix = randomUUID();
const email = `swagger-browser-${suffix}@example.test`;
const adminEmail = `swagger-admin-${suffix}@example.test`;
const password = randomBytes(32).toString('base64url');
const credentialFile = `.env.admin.smoke-${suffix}`;
let fileCreated = false;
let browser;
let ws;
const client = new pg.Client({
  host: env.DB_HOST,
  port: Number(env.DB_PORT),
  user: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_DATABASE,
});
await client.connect();
const mailBase = `http://127.0.0.1:${env.MAILPIT_UI_PORT ?? 8025}`;
const base = `http://127.0.0.1:${env.PORT}`;
let sequence = 0;
const pending = new Map();
const requests = [];
function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Browser command timed out: ${method}`));
    }, 20000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(fn, ...args) {
  const result = await command('Runtime.evaluate', {
    expression: `(${fn.toString()})(...${JSON.stringify(args)})`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      'Browser evaluation failed; secret-bearing details suppressed.',
    );
  return result.result.value;
}
async function waitFor(fn, ...args) {
  const deadline = Date.now() + 20000;
  while (!(await evaluate(fn, ...args))) {
    if (Date.now() > deadline)
      throw new Error('Swagger browser condition timed out.');
    await delay(100);
  }
}
async function execute(path, method, body, status) {
  await evaluate(
    (path, method) => {
      const block = [...document.querySelectorAll('.opblock')].find(
        (b) =>
          b.classList.contains(`opblock-${method}`) &&
          b
            .querySelector('.opblock-summary-path')
            ?.getAttribute('data-path') === path,
      );
      if (!block) throw Error('Operation missing');
      if (!block.classList.contains('is-open'))
        (
          block.querySelector('.opblock-summary-control') ??
          block.querySelector('.opblock-control-arrow') ??
          block.querySelector('.opblock-summary')
        ).click();
    },
    path,
    method,
  );
  await waitFor(
    (path, method) => {
      const b = [...document.querySelectorAll('.opblock')].find(
        (b) =>
          b.classList.contains(`opblock-${method}`) &&
          b
            .querySelector('.opblock-summary-path')
            ?.getAttribute('data-path') === path,
      );
      return !!b?.querySelector('.try-out__btn');
    },
    path,
    method,
  );
  await evaluate(
    (path, method) => {
      const b = [...document.querySelectorAll('.opblock')].find(
        (b) =>
          b.classList.contains(`opblock-${method}`) &&
          b
            .querySelector('.opblock-summary-path')
            ?.getAttribute('data-path') === path,
      );
      const button = b.querySelector('.try-out__btn');
      const clear = [...b.querySelectorAll('button')].find(
        (button) => button.textContent.trim() === 'Clear',
      );
      clear?.click();
      if (button.textContent.includes('Try it out')) button.click();
    },
    path,
    method,
  );
  await waitFor(
    (path, method) => {
      const b = [...document.querySelectorAll('.opblock')].find(
        (b) =>
          b.classList.contains(`opblock-${method}`) &&
          b
            .querySelector('.opblock-summary-path')
            ?.getAttribute('data-path') === path,
      );
      return !!b?.querySelector('button.execute');
    },
    path,
    method,
  );
  if (body !== undefined)
    await evaluate(
      (path, method, body) => {
        const b = [...document.querySelectorAll('.opblock')].find(
          (b) =>
            b.classList.contains(`opblock-${method}`) &&
            b
              .querySelector('.opblock-summary-path')
              ?.getAttribute('data-path') === path,
        );
        const input = b.querySelector('textarea.body-param__text');
        if (!input) throw Error('No request body editor');
        Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          'value',
        ).set.call(input, JSON.stringify(body));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
      path,
      method,
      body,
    );
  await evaluate(
    (path, method) => {
      const b = [...document.querySelectorAll('.opblock')].find(
        (b) =>
          b.classList.contains(`opblock-${method}`) &&
          b
            .querySelector('.opblock-summary-path')
            ?.getAttribute('data-path') === path,
      );
      b.querySelector('button.execute').click();
    },
    path,
    method,
  );
  try {
    await waitFor(
      (path, method, status) => {
        const b = [...document.querySelectorAll('.opblock')].find(
          (b) =>
            b.classList.contains(`opblock-${method}`) &&
            b
              .querySelector('.opblock-summary-path')
              ?.getAttribute('data-path') === path,
        );
        return [
          ...b.querySelectorAll('.live-responses-table .response-col_status'),
        ].some((node) => node.textContent.trim() === String(status));
      },
      path,
      method,
      status,
    );
  } catch (error) {
    const diagnostic = await evaluate(
      (path, method) => {
        const b = [...document.querySelectorAll('.opblock')].find(
          (b) =>
            b.classList.contains(`opblock-${method}`) &&
            b
              .querySelector('.opblock-summary-path')
              ?.getAttribute('data-path') === path,
        );
        let problem;
        for (const node of b.querySelectorAll(
          '.live-responses-table .microlight',
        )) {
          try {
            problem = JSON.parse(node.textContent);
            break;
          } catch {}
        }
        return {
          statuses: [
            ...b.querySelectorAll('.live-responses-table .response-col_status'),
          ].map((node) => node.textContent.trim()),
          code: problem?.code,
          invalidFields: problem?.errors?.map((e) => e.split(' ')[0]),
          executeDisabled: b.querySelector('button.execute')?.disabled,
          validationMarkers: b.querySelectorAll('.invalid').length,
        };
      },
      path,
      method,
    );
    console.error(
      'Swagger response diagnostic (no request values):',
      JSON.stringify(diagnostic),
    );
    throw error;
  }
  return evaluate(
    (path, method) => {
      const b = [...document.querySelectorAll('.opblock')].find(
        (b) =>
          b.classList.contains(`opblock-${method}`) &&
          b
            .querySelector('.opblock-summary-path')
            ?.getAttribute('data-path') === path,
      );
      for (const node of b.querySelectorAll(
        '.live-responses-table .microlight',
      )) {
        try {
          return JSON.parse(node.textContent);
        } catch {}
      }
      throw Error('No JSON response displayed');
    },
    path,
    method,
  );
}
try {
  assert.equal(
    (
      await client.query(
        "SELECT count(*)::int AS n FROM usuario_rol ur JOIN rol r USING(rol_id) WHERE r.rol_nombre='ADMIN'",
      )
    ).rows[0].n,
    0,
    'Browser bootstrap test requires no existing ADMIN; no existing accounts are modified.',
  );
  await writeFile(
    credentialFile,
    `IDENTITY_BOOTSTRAP_ENABLED=true\nADMIN_EMAIL=${adminEmail}\nADMIN_PASSWORD=${password}\nADMIN_FIRST_NAME=Swagger\nADMIN_LAST_NAME=Browser fixture\n`,
    { mode: 0o600, flag: 'wx' },
  );
  fileCreated = true;
  const bootstrap = spawnSync(
    process.execPath,
    [
      '--env-file=.env',
      `--env-file=${credentialFile}`,
      'scripts/bootstrap-admin.mjs',
    ],
    { encoding: 'utf8', timeout: 15000 },
  );
  assert.equal(bootstrap.status, 0, 'Local ADMIN CLI failed.');
  browser = spawn(
    chrome,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${directory}`,
      '--no-first-run',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-default-apps',
      'about:blank',
    ],
    { stdio: 'ignore', windowsHide: true },
  );
  let port;
  const deadline = Date.now() + 30000;
  while (!port) {
    try {
      port = Number(
        (await readFile(join(directory, 'DevToolsActivePort'), 'utf8')).split(
          '\n',
        )[0],
      );
    } catch {
      if (Date.now() > deadline)
        throw new Error('Headless Chrome unavailable.');
      await delay(100);
    }
  }
  const target = await (
    await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
      method: 'PUT',
    })
  ).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id) {
      const p = pending.get(data.id);
      if (p) {
        clearTimeout(p.timer);
        pending.delete(data.id);
        data.error
          ? p.reject(new Error('Browser protocol error'))
          : p.resolve(data.result);
      }
    } else if (data.method === 'Network.requestWillBeSent') {
      const request = data.params.request;
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/v2/'))
        requests.push({
          path: url.pathname,
          method: request.method,
          authenticated: Object.keys(request.headers).some(
            (h) => h.toLowerCase() === 'authorization',
          ),
        });
    }
  };
  await command('Page.enable');
  await command('Runtime.enable');
  await command('Network.enable');
  await command('Page.navigate', { url: base + '/api/docs' });
  await waitFor(
    () => document.querySelectorAll('.swagger-ui .opblock').length === 25,
  );
  const registered = await execute(
    '/api/v2/auth/register',
    'post',
    { email, password, first_name: 'Swagger', last_name: 'Browser fixture' },
    201,
  );
  assert.deepEqual(registered.user.roles, ['CLIENTE']);
  const tokens = await execute(
    '/api/v2/auth/login',
    'post',
    { email, password },
    200,
  );
  assert(tokens.access_token);
  await evaluate(
    (token) => window.ui.preauthorizeApiKey('bearer', token),
    tokens.access_token,
  );
  assert.equal(
    (await execute('/api/v2/auth/me', 'get', undefined, 200)).user.email,
    email,
  );
  assert.equal(
    (await execute('/api/v2/users/me', 'get', undefined, 200)).email,
    email,
  );
  await execute('/api/v2/users', 'get', undefined, 403);
  const adminTokens = await execute(
    '/api/v2/auth/login',
    'post',
    { email: adminEmail, password },
    200,
  );
  await evaluate(
    (token) => window.ui.preauthorizeApiKey('bearer', token),
    adminTokens.access_token,
  );
  const page = await execute('/api/v2/users', 'get', undefined, 200);
  assert(page.items.some((u) => u.email === adminEmail));
  const roles = await execute('/api/v2/roles', 'get', undefined, 200);
  assert(roles.some((r) => r.name === 'ADMIN'));
  assert(
    requests
      .filter((r) => r.path === '/api/v2/auth/login')
      .every((r) => !r.authenticated),
  );
  assert(
    requests.some((r) => r.path === '/api/v2/users/me' && r.authenticated),
  );
  assert.equal(
    await evaluate(() => !!localStorage.getItem('authorized')),
    false,
  );
  await writeFile(
    'docs/fase-f-browser-evidence.json',
    JSON.stringify(
      {
        checked_at_utc: new Date().toISOString(),
        phase: 'F',
        browser: 'Chrome headless, isolated temporary profile',
        swagger_ui_loaded: true,
        rendered_operations: 25,
        try_it_out_registration_201: true,
        try_it_out_public_login_200: true,
        swagger_bearer_authorized: true,
        auth_me_200: true,
        users_me_200: true,
        client_admin_operation_403: true,
        admin_operations_200: true,
        public_login_omits_bearer: true,
        bearer_not_persisted: true,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'PASS: real Swagger UI Try it out in Chrome: register/login, Bearer, both me endpoints, CLIENTE 403 and ADMIN 200. No credentials printed.',
  );
} finally {
  if (ws?.readyState === WebSocket.OPEN) {
    try {
      await command('Browser.close');
    } catch {}
  }
  ws?.close();
  if (browser && browser.exitCode === null) {
    browser.kill();
    await delay(1000);
  }
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.reject(new Error('Browser closed'));
  }
  pending.clear();
  await client.query('DELETE FROM usuario WHERE usu_correo=ANY($1::text[])', [
    [email, adminEmail],
  ]);
  await client.end();
  const list = await (
    await fetch(`${mailBase}/api/v1/messages?limit=1000`)
  ).json();
  const ids = list.messages
    .filter((m) => m.To.some((t) => [email, adminEmail].includes(t.Address)))
    .map((m) => m.ID);
  if (ids.length)
    await fetch(`${mailBase}/api/v1/messages`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ IDs: ids }),
    });
  if (fileCreated) await unlink(credentialFile);
  if (
    dirname(resolve(directory)) !== resolve(tmpdir()) ||
    !basename(directory).startsWith('identity-swagger-')
  )
    throw new Error('Unexpected browser cleanup path');
  await rm(directory, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
