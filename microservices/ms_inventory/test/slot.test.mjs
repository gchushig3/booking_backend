import { test } from 'node:test';
import assert from 'node:assert/strict';
import { time24, validateSlot, timestamp } from '../dist/slot.js';

void test('time_slot admite las representaciones del proto sin confundir medianoche/mediodia', () => {
  assert.equal(time24('12:00 a.m.'), '00:00:00');
  assert.equal(time24('12:00 p.m.'), '12:00:00');
  assert.equal(time24('10:30:00'), '10:30:00');
  assert.throws(() => time24('24:00:00'));
});
void test('fecha, slot_id y hora deben identificar la misma franja; int64 no pierde precision', () => {
  const key = {
    serviceId: 'NODE_ATR_TEST',
    itemId: 'attraction-1',
    date: '2028-02-29',
    timeSlot: '10:30 a.m.',
    slotId: 'slot-20280229-1030',
  };
  assert.doesNotThrow(() => validateSlot(key));
  assert.throws(() => validateSlot({ ...key, date: '2027-02-29' }));
  assert.throws(() => validateSlot({ ...key, slotId: 'slot-20280229-1130' }));
  assert.equal(timestamp('9223372036854775807'), '9223372036854775807');
  assert.throws(() => timestamp('9223372036854775808'));
});
