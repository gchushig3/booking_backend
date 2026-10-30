import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchAttractionsDto } from '../../src/modules/attractions/dto/search-attractions.dto.js';
import { UpdatePhotoDto } from '../../src/modules/attractions/dto/photo.dto.js';

describe('Optional filters preserve invalid input for validation', () => {
  it.each([{}, []])('rejects invalid query text %j', async (value) => {
    const dto = plainToInstance(SearchAttractionsDto, { query: value });
    expect((await validate(dto)).map((error) => error.property)).toContain(
      'query',
    );
  });

  it('rejects a non-string optional enum instead of dropping it', async () => {
    const dto = plainToInstance(SearchAttractionsDto, { type: {} });
    expect((await validate(dto)).map((error) => error.property)).toContain(
      'type',
    );
  });

  it('rejects a malformed optional photo URL at DTO level', async () => {
    const dto = plainToInstance(UpdatePhotoDto, { url: {} });
    expect((await validate(dto)).map((error) => error.property)).toContain(
      'url',
    );
  });
  it.each(['not-a-number', {}, [], true])(
    'rejects invalid city_id %j',
    async (value) => {
      const dto = plainToInstance(SearchAttractionsDto, { city_id: value });
      expect((await validate(dto)).map((error) => error.property)).toContain(
        'city_id',
      );
    },
  );

  it.each(['maybe', '', 42, {}, []])(
    'rejects invalid featured %j',
    async (value) => {
      const dto = plainToInstance(SearchAttractionsDto, { featured: value });
      expect((await validate(dto)).map((error) => error.property)).toContain(
        'featured',
      );
    },
  );

  it.each([
    [true, true],
    [false, false],
    ['true', true],
    ['false', false],
    ['1', true],
    ['0', false],
    [1, true],
    [0, false],
  ])('preserves accepted boolean conversion %j', async (value, expected) => {
    const dto = plainToInstance(SearchAttractionsDto, { featured: value });
    expect(await validate(dto)).toEqual([]);
    expect(dto.featured).toBe(expected);
  });

  it.each(['1', 2])(
    'preserves accepted numeric conversion %j',
    async (value) => {
      const dto = plainToInstance(SearchAttractionsDto, { city_id: value });
      expect(await validate(dto)).toEqual([]);
      expect(dto.city_id).toBe(Number(value));
    },
  );

  it('keeps omitted filters optional and preserves pagination defaults', async () => {
    const dto = plainToInstance(SearchAttractionsDto, {});
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({ page: 1, limit: 10 });
    expect(dto.featured).toBeUndefined();
    expect(dto.city_id).toBeUndefined();
  });
});
