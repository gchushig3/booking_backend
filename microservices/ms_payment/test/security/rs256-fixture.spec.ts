import { webcrypto } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRs256Fixture } from './support/rs256-fixture.js';
import type {
  PublicRsaJwk,
  Rs256Fixture,
} from './support/security-test-types.js';

/** Independent WebCrypto API checks the signature only, NOT a JWT verifier. */
async function signatureMatches(
  token: string,
  jwk: PublicRsaJwk,
): Promise<boolean> {
  const [header, payload, signature] = token.split('.');
  const publicKey = await webcrypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['verify'],
  );
  return webcrypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    Uint8Array.from(Buffer.from(signature, 'base64url')),
    Uint8Array.from(Buffer.from(`${header}.${payload}`)),
  );
}

describe('Local RS256 fixture, no production JWT verification', () => {
  let fixture: Rs256Fixture;
  let other: Rs256Fixture;
  const issuedAt = Math.floor(Date.now() / 1000);
  const claims = {
    iss: 'urn:payment:test:issuer',
    aud: 'urn:payment:test:audience',
    sub: 'opaque-fixture-subject',
    client_id: 'fixture-client',
    iat: issuedAt,
    exp: issuedAt + 300,
    scope: 'payment:read',
  };

  beforeAll(async () => {
    fixture = await createRs256Fixture();
    other = await createRs256Fixture();
  }, 15000);
  afterAll(() => {
    fixture?.dispose();
    other?.dispose();
  });

  it('generates distinct ephemeral RSA keys and exposes only public JWKS', () => {
    const key = fixture.getJwks().keys[0];
    expect(key.kty).toBe('RSA');
    expect(key.alg).toBe('RS256');
    expect(key.use).toBe('sig');
    expect(key.kid).not.toBe(other.getJwks().keys[0].kid);
    expect(key.n).not.toBe(other.getJwks().keys[0].n);
    expect(Object.keys(key).sort()).toEqual(
      ['kty', 'n', 'e', 'alg', 'use', 'kid'].sort(),
    );
    expect(Buffer.from(key.n, 'base64url').byteLength).toBe(256);
    expect(Object.isFrozen(fixture.getJwks().keys)).toBe(true);
    expect(Object.isFrozen(key)).toBe(true);
    expect(Object.keys(fixture).sort()).toEqual(
      ['sign', 'getJwks', 'rotate', 'retire', 'dispose'].sort(),
    );
  });

  it('creates a compact JWT whose signature is independently verified with its public key', async () => {
    const token = fixture.sign(claims);
    expect(token.split('.')).toHaveLength(3);
    expect(await signatureMatches(token, fixture.getJwks().keys[0])).toBe(true);
    const header = JSON.parse(
      Buffer.from(token.split('.')[0], 'base64url').toString(),
    ) as unknown;
    expect(header).toEqual({
      alg: 'RS256',
      typ: 'at+jwt',
      kid: fixture.getJwks().keys[0].kid,
    });
  });

  it('rejects a modified signature and a different public key', async () => {
    const token = fixture.sign(claims);
    const parts = token.split('.');
    const signature = Buffer.from(parts[2], 'base64url');
    signature[0] ^= 1;
    const damaged = `${parts[0]}.${parts[1]}.${signature.toString('base64url')}`;
    expect(await signatureMatches(damaged, fixture.getJwks().keys[0])).toBe(
      false,
    );
    expect(await signatureMatches(token, other.getJwks().keys[0])).toBe(false);
  });

  it('fails cryptographic verification after a signed payload is altered', async () => {
    const parts = fixture.sign(claims).split('.');
    const payload = Buffer.from(
      JSON.stringify({ ...claims, sub: 'tampered' }),
    ).toString('base64url');
    expect(
      await signatureMatches(
        `${parts[0]}.${payload}.${parts[2]}`,
        fixture.getJwks().keys[0],
      ),
    ).toBe(false);
  });

  it('treats kid as signed data and supports deliberate unknown-kid fixtures', async () => {
    const parts = fixture.sign(claims).split('.');
    const modifiedHeader = Buffer.from(
      JSON.stringify({ alg: 'RS256', typ: 'at+jwt', kid: 'unknown' }),
    ).toString('base64url');
    expect(
      await signatureMatches(
        `${modifiedHeader}.${parts[1]}.${parts[2]}`,
        fixture.getJwks().keys[0],
      ),
    ).toBe(false);
    const signedUnknownKid = fixture.sign(claims, { kid: 'unknown' });
    expect(
      await signatureMatches(signedUnknownKid, fixture.getJwks().keys[0]),
    ).toBe(true);
    expect(
      fixture.getJwks().keys.find((key) => key.kid === 'unknown'),
    ).toBeUndefined();
    // A valid signature is not automatic acceptance or a trusted kid selection.
  });

  it('preserves controlled invalid claims and ID-token-like types without authenticating them', async () => {
    const invalid = {
      ...claims,
      exp: 1,
      nbf: 9999999999,
      aud: 'wrong-audience',
      scope: 'ADMIN',
    };
    const token = fixture.sign(invalid, { typ: 'JWT' });
    expect(
      JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()),
    ).toEqual(invalid);
    expect(await signatureMatches(token, fixture.getJwks().keys[0])).toBe(true);
    const missingSubject = fixture.sign({ exp: 1 });
    expect(
      JSON.parse(
        Buffer.from(missingSubject.split('.')[1], 'base64url').toString(),
      ),
    ).toEqual({ exp: 1 });
    expect('verify' in fixture).toBe(false);
    expect('authenticate' in fixture).toBe(false);
  });

  it('rotates signing keys, retains the previous public key and retires it explicitly', async () => {
    const old = fixture.getJwks().keys[0];
    const oldToken = fixture.sign(claims);
    const snapshot = fixture.getJwks();
    const nextKid = await fixture.rotate();
    const next = fixture.getJwks().keys.find((key) => key.kid === nextKid)!;
    const newToken = fixture.sign(claims);
    expect(fixture.getJwks().keys).toHaveLength(2);
    expect(snapshot.keys).toHaveLength(1);
    expect(await signatureMatches(oldToken, old)).toBe(true);
    expect(await signatureMatches(newToken, next)).toBe(true);
    expect(await signatureMatches(newToken, old)).toBe(false);
    expect(await signatureMatches(oldToken, next)).toBe(false);
    fixture.retire(old.kid);
    expect(
      fixture.getJwks().keys.find((key) => key.kid === old.kid),
    ).toBeUndefined();
    expect(() => fixture.retire(nextKid)).toThrow(
      'Cannot retire the active test key',
    );
  });

  it('releases key references on disposal and cannot sign or rotate afterwards', async () => {
    const disposable = await createRs256Fixture();
    disposable.dispose();
    disposable.dispose();
    expect(disposable.getJwks().keys).toHaveLength(0);
    expect(() => disposable.sign(claims)).toThrow('disposed');
    await expect(disposable.rotate()).rejects.toThrow('disposed');
  });

  it('keeps the fixture outside the production build and gives it no persistence/network imports', () => {
    const build = JSON.parse(readFileSync('tsconfig.build.json', 'utf8')) as {
      exclude: string[];
    };
    expect(build.exclude).toContain('test');
    const source = readFileSync(
      'test/security/support/rs256-fixture.ts',
      'utf8',
    );
    expect(source).not.toMatch(
      /from ['"]node:(fs|http|https|net)|writeFile|privateKey\.export/,
    );
    function typescriptFiles(directory: string): string[] {
      return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? typescriptFiles(join(directory, entry.name))
          : [join(directory, entry.name)],
      );
    }
    for (const path of typescriptFiles('src').filter(
      (path) => !path.endsWith('.spec.ts'),
    )) {
      expect(readFileSync(path, 'utf8'), path).not.toContain('rs256-fixture');
    }
  });
});
