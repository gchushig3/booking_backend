import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join, dirname, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigService } from '@nestjs/config';
import { RegisterDto, LoginDto } from '../../src/auth/auth.dto.js';
import { IdentityJwtService } from '../../src/auth/jwt.service.js';
import { PasswordService } from '../../src/auth/password.service.js';
import { authSettings } from '../../src/auth/auth.settings.js';
import type { AuthSettings } from '../../src/auth/auth.settings.js';

const settings: AuthSettings = {
  keyringPath: '',
  issuer: 'urn:descubreec:identity',
  accessAudience: 'urn:descubreec:internal-api',
  refreshAudience: 'urn:descubreec:identity:refresh',
  accessSeconds: 900,
  refreshSeconds: 604800,
  bcryptRounds: 4,
  loginLimit: 5,
  recoveryLimit: 3,
};
const valid = {
  email: 'Example@example.test',
  first_name: 'Name',
  last_name: 'Last',
  password: 'Secure-test-password',
};
describe('Authentication DTOs', () => {
  it('normalizes email and names, preserving password bytes', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...valid,
      email: ' EXAMPLE@example.test ',
      first_name: ' Name ',
      password: '  safe password 42  ',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.email).toBe('example@example.test');
    expect(dto.first_name).toBe('Name');
    expect(dto.password).toBe('  safe password 42  ');
  });
  it.each(['short', 'a'.repeat(73), '🙂'.repeat(19), 'abc\0long-password'])(
    'rejects password policy violations (%#)',
    async (password) => {
      expect(
        (await validate(plainToInstance(RegisterDto, { ...valid, password })))
          .length,
      ).toBeGreaterThan(0);
    },
  );
  it('accepts precisely 72 UTF8 bytes and rejects an administrative property', async () => {
    expect(
      await validate(
        plainToInstance(RegisterDto, { ...valid, password: '🙂'.repeat(18) }),
      ),
    ).toHaveLength(0);
    const errors = await validate(
      plainToInstance(RegisterDto, { ...valid, roles: ['ADMIN'] }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.some((e) => e.property === 'roles')).toBe(true);
  });
  it('rejects empty names and non-string input without implicit coercion', async () => {
    expect(
      (
        await validate(
          plainToInstance(RegisterDto, {
            ...valid,
            first_name: '   ',
            email: 42,
            password: 42,
          }),
        )
      ).length,
    ).toBe(3);
  });
  it('allows a short existing password at login, without applying registration minimum', async () => {
    expect(
      await validate(
        plainToInstance(LoginDto, { email: valid.email, password: 'old' }),
      ),
    ).toHaveLength(0);
  });
});
describe('Real RSA keyring and token separation', () => {
  let directory: string;
  let jwt: IdentityJwtService;
  let ring: {
    activeKid: string;
    keys: Array<{
      kid: string;
      publicJwk: JsonWebKey;
      privateJwk?: JsonWebKey;
    }>;
  };
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'identity-auth-'));
    const pair = generateKeyPairSync('rsa', { modulusLength: 3072 });
    const kid = randomUUID();
    ring = {
      activeKid: kid,
      keys: [
        {
          kid,
          publicJwk: pair.publicKey.export({ format: 'jwk' }),
          privateJwk: pair.privateKey.export({ format: 'jwk' }),
        },
      ],
    };
    settings.keyringPath = join(directory, 'keyring.json');
    await writeFile(settings.keyringPath, JSON.stringify(ring));
    jwt = new IdentityJwtService(settings);
    await jwt.onModuleInit();
  });
  afterAll(async () => {
    if (directory) {
      if (
        dirname(resolve(directory)) !== resolve(tmpdir()) ||
        !basename(directory).startsWith('identity-auth-')
      )
        throw new Error('Unexpected temporary path');
      await rm(directory, { recursive: true });
    }
  });
  it('preserves a BIGINT above Number.MAX_SAFE_INTEGER without precision loss', async () => {
    const tokens = await jwt.issue(
      '9007199254740993',
      randomUUID(),
      ['CLIENTE'],
      new Date(Date.now() + 3600000),
    );
    expect((await jwt.verify(tokens.access_token, 'access')).sub).toBe(
      '9007199254740993',
    );
    await expect(
      jwt.verify(tokens.refresh_token, 'access'),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      jwt.verify(tokens.access_token, 'refresh'),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('rejects forged tokens and expired signed access tokens', async () => {
    const tokens = await jwt.issue(
      '1',
      randomUUID(),
      ['CLIENTE'],
      new Date(Date.now() - 1000),
    );
    await expect(
      jwt.verify(tokens.access_token, 'access'),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      jwt.verify(tokens.refresh_token, 'refresh'),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      jwt.verify('eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.', 'access'),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('retains verification of old tokens after key rotation and never exposes private key parameters', async () => {
    const old = await jwt.issue(
      '1',
      randomUUID(),
      ['CLIENTE'],
      new Date(Date.now() + 3600000),
    );
    const pair = generateKeyPairSync('rsa', { modulusLength: 3072 });
    const kid = randomUUID();
    for (const key of ring.keys) delete key.privateJwk;
    ring.activeKid = kid;
    ring.keys.push({
      kid,
      publicJwk: pair.publicKey.export({ format: 'jwk' }),
      privateJwk: pair.privateKey.export({ format: 'jwk' }),
    });
    await writeFile(settings.keyringPath, JSON.stringify(ring));
    const rotated = new IdentityJwtService(settings);
    await rotated.onModuleInit();
    expect((await rotated.verify(old.access_token, 'access')).sub).toBe('1');
    expect(rotated.jwks().keys).toHaveLength(2);
    for (const key of rotated.jwks().keys)
      expect(Object.keys(key).sort()).toEqual([
        'alg',
        'e',
        'kid',
        'kty',
        'n',
        'use',
      ]);
    const fresh = await rotated.issue(
      '1',
      randomUUID(),
      ['CLIENTE'],
      new Date(Date.now() + 3600000),
    );
    expect(
      (await rotated.verify(fresh.refresh_token, 'refresh')).sid,
    ).toBeTruthy();
  });
});
describe('Password hashing and safe configuration', () => {
  it('rejects an empty issuer or keyring path', () => {
    expect(() =>
      authSettings(
        new ConfigService({ identity: { APP_ENV: 'local' }, JWT_ISSUER: '' }),
      ),
    ).toThrow('JWT_ISSUER');
    expect(() =>
      authSettings(
        new ConfigService({
          identity: { APP_ENV: 'local' },
          JWT_KEYRING_PATH: '',
        }),
      ),
    ).toThrow('JWT_KEYRING_PATH');
  });
  it('uses real bcrypt and denies unknown accounts even after the dummy comparison', async () => {
    const service = new PasswordService(settings);
    await service.onModuleInit();
    const hash = await service.hash('safe-password-42');
    expect(hash).not.toContain('safe-password');
    expect(await service.verify('safe-password-42', hash)).toBe(true);
    expect(await service.verify('wrong', hash)).toBe(false);
    expect(await service.verify('wrong')).toBe(false);
  });
  it('requires an explicit production keyring and disallows low bcrypt cost outside tests', () => {
    expect(() =>
      authSettings(new ConfigService({ identity: { APP_ENV: 'production' } })),
    ).toThrow('explicit keyring');
    expect(() =>
      authSettings(
        new ConfigService({
          identity: { APP_ENV: 'local' },
          BCRYPT_ROUNDS: '4',
        }),
      ),
    ).toThrow('BCRYPT_ROUNDS');
  });
});
