import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import SwaggerParser from '@apidevtools/swagger-parser';
import { parseDocument } from 'yaml';
const env = parseEnv(await readFile('.env', 'utf8'));
assert.equal(env.APP_ENV, 'local');
const base = `http://127.0.0.1:${env.PORT}`;
async function get(path, expected = 200, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: { 'X-Correlation-Id': 'cid-identity-phase-f', ...options.headers },
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, expected, path);
  assert.equal(
    response.headers.get('x-correlation-id'),
    'cid-identity-phase-f',
  );
  return response;
}
assert.match(await (await get('/api/docs')).text(), /swagger-ui/);
for (const asset of [
  'swagger-ui-bundle.js',
  'swagger-ui.css',
  'swagger-ui-init.js',
])
  await get(`/api/docs/${asset}`);
const init = await (await get('/api/docs/swagger-ui-init.js')).text();
assert.match(init, /"persistAuthorization":\s*false/);
assert.match(init, /"validatorUrl":\s*null/);
const document = await (await get('/api/docs-json')).json();
const yaml = parseDocument(await (await get('/api/docs-yaml')).text(), {
  uniqueKeys: true,
});
assert.equal(yaml.errors.length, 0);
assert.deepEqual(yaml.toJS(), document);
await SwaggerParser.validate(structuredClone(document), {
  resolve: { external: false },
});
assert.deepEqual(
  document,
  JSON.parse(await readFile('docs/openapi.json', 'utf8')),
);
const localYaml = parseDocument(await readFile('docs/openapi.yaml', 'utf8'), {
  uniqueKeys: true,
});
assert.equal(localYaml.errors.length, 0);
assert.deepEqual(localYaml.toJS(), document);
const operations = Object.values(document.paths).flatMap((path) =>
  Object.values(path),
);
assert.equal(operations.length, 25);
for (const op of operations) {
  assert(op.summary);
  assert(op.parameters.some((p) => p.name === 'X-Correlation-Id'));
}
await get('/api/v2/auth/me', 401);
await get('/api/v2/users', 401);
await get('/api/v2/roles', 401);
await get('/api/v2/auth/login', 400, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'invalid', password: 'invalid' }),
});
await get('/api/v2/health/ready');
await writeFile(
  'docs/fase-f-evidence.json',
  JSON.stringify(
    {
      checked_at_utc: new Date().toISOString(),
      phase: 'F',
      base_url: base,
      swagger_public: true,
      local_assets: true,
      bearer_not_persisted: true,
      external_validator_disabled: true,
      openapi: document.openapi,
      operations: operations.length,
      json_yaml_valid_and_synchronized: true,
      correlation_header: true,
      protected_routes_require_jwt: true,
      login_public_validation: true,
      postgres_ready: true,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'PASS: public Swagger UI/assets, valid synchronized JSON/YAML and correct protected/public HTTP behavior. No tokens or users generated.',
);
