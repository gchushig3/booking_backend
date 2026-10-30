import { readFileSync } from 'node:fs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BigIntIdPipe } from './bigint-id.pipe.js';
import { CrearPagoRequestDto } from '../../pago/dto/crear-pago-request.dto.js';
import { ListarPagosQueryDto } from '../../pago/dto/listar-pagos-query.dto.js';
import {
  isBigIntId,
  POSTGRES_BIGINT_ID_MAX,
} from '../validation/bigint-id.validation.js';

// Read the actual canonical schema, not a copied expression or a generated candidate.
const contract = readFileSync('contract/ms_payment-openapi-v2.yaml', 'utf8');
const schema = /    BigId:\r?\n([\s\S]*?)(?=    Importe:)/.exec(contract)?.[1];
if (!schema) throw new Error('Canonical BigId schema not found');
const pattern = /      pattern: '([^']+)'/.exec(schema)?.[1];
if (!pattern) throw new Error('Canonical BigId pattern not found');
const contractPattern = new RegExp(pattern);
const maximum = 9223372036854775807n;

// Independent oracle: no production helper, shared constant, or decimal regex.
function oracle(value: unknown): boolean {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 19 ||
    value[0] === '0'
  )
    return false;
  for (const character of value) {
    if (character < '0' || character > '9') return false;
  }
  return BigInt(value) >= 1n && BigInt(value) <= maximum;
}

const cases: [unknown, boolean][] = [
  ['1', true],
  ['42', true],
  ['9007199254740993', true],
  ['9199999999999999999', true],
  ['9200000000000000000', true],
  ['9220000000000000000', true],
  ['9223372036854775800', true],
  ['9223372036854775806', true],
  ['9223372036854775807', true],
  ['9223372036854775808', false],
  ['9999999999999999999', false],
  ['10000000000000000000', false],
  ['0', false],
  ['-1', false],
  ['01', false],
  ['+1', false],
  ['1.0', false],
  ['1e3', false],
  ['', false],
  ['abc', false],
  [' 1', false],
  ['1 ', false],
  ['1\n', false],
  ['1\r\n', false],
  ['1\u2028', false],
  ['1\u2029', false],
  ['1\t', false],
  ['1\u0000', false],
  ['１２', false],
  [1, false],
  [9007199254740992, false],
  [null, false],
  [undefined, false],
  [1n, false],
  [true, false],
  [NaN, false],
  [Infinity, false],
  [{}, false],
  [['1'], false],
];

async function check(value: unknown): Promise<void> {
  const expected = oracle(value);
  const acceptedByContract =
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 19 &&
    contractPattern.test(value);
  expect(acceptedByContract, String(value)).toBe(expected);
  expect(isBigIntId(value), String(value)).toBe(expected);
  const pipe = new BigIntIdPipe();
  if (expected) expect(pipe.transform(value)).toBe(value);
  else
    expect(() => pipe.transform(value)).toThrow(
      expect.objectContaining({
        status: 400,
        response: expect.objectContaining({
          statusCode: 400,
          code: 'INVALID_ID',
        }),
      }),
    );
  const request = plainToInstance(CrearPagoRequestDto, {
    numero: 'BIGID-AUDIT',
    orden_id: value,
    metodo_codigo: 'TARJETA',
    monto: '1.00',
  });
  const query = plainToInstance(ListarPagosQueryDto, { ord_id: value });
  expect((await validate(request)).length === 0, String(value)).toBe(expected);
  // This filter is optional only when omitted; explicit null is not a BigId.
  expect((await validate(query)).length === 0, String(value)).toBe(
    value === undefined || expected,
  );
  if (expected) {
    expect(request.orden_id).toBe(value);
    expect(query.ord_id).toBe(value);
  }
}

describe('BigId corrected contract / shared validator / pipe / DTO equivalence', () => {
  it('keeps the string schema and documented lengths and shared maximum', () => {
    expect(schema).toContain('type: string');
    expect(schema).toContain('minLength: 1');
    expect(schema).toContain('maxLength: 19');
    expect(POSTGRES_BIGINT_ID_MAX).toBe(maximum);
    expect(pattern).toBe(
      readFileSync('docs/bigid-proposed-pattern.txt', 'utf8').trim(),
    );
  });

  it.each(cases)(
    'validates boundary/type %s as %s without normalization',
    async (value, expected) => {
      expect(oracle(value)).toBe(expected);
      await check(value);
    },
  );

  it('compares every decimal-prefix boundary and deterministic generated values with BigInt', async () => {
    const values = new Set<string>();
    const max = String(maximum);
    for (let index = 0; index < max.length; index += 1) {
      for (const digit of '0123456789') {
        for (const fill of ['0', '9']) {
          const value =
            max.slice(0, index) + digit + fill.repeat(max.length - index - 1);
          values.add(value);
          for (const delta of [-1n, 1n])
            values.add(String(BigInt(value) + delta));
        }
      }
    }
    let seed = 0x123456789abcdefn;
    for (let index = 0; index < 1024; index += 1) {
      seed = (seed * 6364136223846793005n + 1442695040888963407n) % (1n << 64n);
      const value = String(seed);
      values.add(value);
      values.add(String(seed % (maximum + 1n)));
      values.add(String(seed % 10n ** BigInt((index % 22) + 1)));
      if (index < 64) {
        for (const malformed of [
          `0${value}`,
          `+${value}`,
          `-${value}`,
          `${value}.0`,
          `${value}e0`,
          `${value}\n`,
          `${value} `,
        ])
          values.add(malformed);
      }
    }
    for (const value of values) await check(value);
    expect(values.size).toBeGreaterThan(3000);
  }, 30000);
});
