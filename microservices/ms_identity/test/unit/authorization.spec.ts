import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  IdentityIdPipe,
  RoleIdPipe,
} from '../../src/users/identity-id.pipe.js';
import {
  ProfileDto,
  PaginationDto,
  AssignRoleDto,
  StatusDto,
} from '../../src/users/users.dto.js';
describe('Authorization boundary validation', () => {
  it('preserves PostgreSQL BIGINT precision through the maximum ID', () => {
    const pipe = new IdentityIdPipe();
    expect(pipe.transform('9007199254740993')).toBe('9007199254740993');
    expect(pipe.transform('9223372036854775807')).toBe('9223372036854775807');
    for (const id of ['0', '-1', '01', '1e3', '9223372036854775808'])
      expect(() => pipe.transform(id)).toThrow();
  });
  it('rejects IDs outside PostgreSQL SMALLINT before reaching SQL', () => {
    const pipe = new RoleIdPipe();
    expect(pipe.transform('32767')).toBe(32767);
    for (const id of ['0', '32768', '999999999999', '1.2', '-1'])
      expect(() => pipe.transform(id)).toThrow();
  });
  it.each(['2001-02-29', '2024-04-31', '2024-1-01', '0000-01-01'])(
    'rejects invalid calendar date %s',
    async (birth_date) => {
      expect(
        (await validate(plainToInstance(ProfileDto, { birth_date }))).length,
      ).toBeGreaterThan(0);
    },
  );
  it('accepts a real leap date and explicit nullable fields but rejects null names', async () => {
    expect(
      await validate(
        plainToInstance(ProfileDto, {
          birth_date: '2000-02-29',
          document: null,
          phone: null,
          avatar_url: null,
        }),
      ),
    ).toHaveLength(0);
    expect(
      (await validate(plainToInstance(ProfileDto, { first_name: null })))
        .length,
    ).toBeGreaterThan(0);
  });
  it('requires real booleans and numbers in JSON, with pagination conversion limited to query DTOs', async () => {
    expect(
      (await validate(plainToInstance(StatusDto, { active: 'false' }))).length,
    ).toBeGreaterThan(0);
    expect(
      (await validate(plainToInstance(AssignRoleDto, { role_id: '1' }))).length,
    ).toBeGreaterThan(0);
    const query = plainToInstance(PaginationDto, { page: '2', limit: '100' });
    expect(await validate(query)).toHaveLength(0);
    expect(query.page).toBe(2);
  });
});
