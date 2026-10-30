const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('reflect-metadata');
const { validateSagaEvent, consumeSaga, sagaHash } = require('../dist');

function event() {
  const id = randomUUID();
  return { eventoId: randomUUID(), tipo: 'reserva.creada', origen: 'ms_cart', fechaISO: new Date().toISOString(), correlationId: id,
    data: { reservationId: id, userId: '1', expiresAt: new Date(Date.now() + 60000).toISOString(), currency: 'USD', amountCents: 2000,
      lines: [{ attractionId: '1', itemId: 'public-1', serviceId: 'NODE', date: '2099-01-01', timeSlot: '10:30:00', slotId: 'slot-20990101-1030', adults: 1, children: 0, amountCents: 2000 }] } };
}
test('contrato Saga impide emisor incorrecto, totales inconsistentes y correlacion ajena', () => {
  const valid = event();
  assert.equal(validateSagaEvent(valid), valid);
  assert.throws(() => validateSagaEvent({ ...valid, origen: 'ms_payment' }));
  assert.throws(() => validateSagaEvent({ ...valid, data: { ...valid.data, amountCents: 1 } }));
  assert.throws(() => validateSagaEvent({ ...valid, correlationId: randomUUID() }));
  assert.equal(sagaHash({ a: 1, b: 2 }), sagaHash({ b: 2, a: 1 }));
});
test('ack sigue al commit; mensajes invalidos van a DLQ y fallos transitorios se reencolan', async () => {
  const valid = event();
  const calls = [];
  const context = { getChannelRef: () => ({ ack: () => calls.push('ack'), nack: (_m, _all, requeue) => calls.push(requeue ? 'retry' : 'dlq') }),
    getMessage: () => ({}), getPattern: () => valid.tipo };
  await consumeSaga(context, valid, async () => { calls.push('commit'); });
  assert.deepEqual(calls, ['commit', 'ack']);
  await consumeSaga(context, {}, async () => { throw new Error('not reached'); });
  assert.equal(calls.at(-1), 'dlq');
  await consumeSaga(context, valid, async () => { throw new Error('temporary database outage'); });
  assert.equal(calls.at(-1), 'retry');
});
