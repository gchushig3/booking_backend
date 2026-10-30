const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { ConfigService } = require('@nestjs/config');
const { JsonSchemaValidationPipe, neonOptions, rabbitMqOptions, inventoryGrpcOptions } = require('../dist');

test('Neon SSL cannot be overridden by URL parameters; schema synchronization disabled', () => {
  const options = neonOptions(new ConfigService({
    DATABASE_URL: 'postgresql://user:pass@db.example/test?sslmode=disable&ssl=true&sslcert=bad',
  }));
  assert.deepEqual(options.ssl, { rejectUnauthorized: false });
  assert.equal(new URL(options.url).search, '');
  assert.equal(options.synchronize, false);
});

test('REST contract rejects extras, invalid formats, and coercion without mutating input', () => {
  const pipe = new JsonSchemaValidationPipe({
    type: 'object', required: ['email', 'count'], additionalProperties: false,
    properties: { email: { type: 'string', format: 'email' }, count: { type: 'integer' } },
  });
  const valid = { email: 'a@example.com', count: 1 };
  assert.equal(pipe.transform(valid), valid);
  for (const payload of [{ ...valid, extra: true }, { ...valid, email: 'invalid' }, { ...valid, count: '1' }]) {
    const before = structuredClone(payload);
    assert.throws(() => pipe.transform(payload), (error) => error.getStatus() === 400);
    assert.deepEqual(payload, before);
  }
});

test('CloudAMQP requires TLS, durable queue, manual acknowledgements and valid prefetch', () => {
  const config = new ConfigService({ AMQP_URL: 'amqps://u:p@broker.example/v', AMQP_QUEUE: 'ms_payment.events' });
  const { options } = rabbitMqOptions(config);
  assert.equal(options.noAck, false);
  assert.equal(options.queueOptions.durable, true);
  assert.equal(options.persistent, true);
  assert.throws(() => rabbitMqOptions(new ConfigService({ AMQP_URL: 'amqp://localhost' })));
  assert.throws(() => rabbitMqOptions(new ConfigService({
    AMQP_URL: 'amqps://u:p@broker.example/v', AMQP_QUEUE: 'test', AMQP_PREFETCH: 'NaN',
  })));
});

test('gRPC uses the existing inventory package and configurable Railway target', () => {
  const config = new ConfigService({ INVENTORY_PROTO_PATH: '/contracts/inventory.proto',
    INVENTORY_GRPC_URL: 'inventory.railway.internal:50051' });
  assert.equal(inventoryGrpcOptions(config).options.package, 'inventory');
  assert.equal(inventoryGrpcOptions(config).options.url, 'inventory.railway.internal:50051');
  assert.equal(inventoryGrpcOptions(config, true).options.url, '0.0.0.0:50051');
});
