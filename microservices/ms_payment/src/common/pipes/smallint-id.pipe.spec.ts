import { BadRequestException } from '@nestjs/common';
import { SmallIntIdPipe } from './smallint-id.pipe.js';

describe('SmallIntIdPipe', () => {
  const pipe = new SmallIntIdPipe();

  it.each([
    ['1', 1],
    ['32767', 32767],
  ])('parses valid id %s', (value, expected) => {
    expect(pipe.transform(value)).toBe(expected);
  });

  it.each(['0', '-1', '32768', '1.5', 'abc', ''])(
    'rejects invalid id %s',
    (value) => {
      expect(() => pipe.transform(value)).toThrow(BadRequestException);
    },
  );
});
