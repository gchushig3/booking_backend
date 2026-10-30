import {
  constants,
  generateKeyPair,
  randomUUID,
  sign,
  type KeyObject,
} from 'node:crypto';
import type { PublicRsaJwk, Rs256Fixture } from './security-test-types.js';

async function generateFixtureKey(): Promise<{
  privateKey: KeyObject;
  jwk: PublicRsaJwk;
}> {
  const { publicKey, privateKey } = await new Promise<{
    publicKey: KeyObject;
    privateKey: KeyObject;
  }>((resolve, reject) =>
    generateKeyPair(
      'rsa',
      { modulusLength: 2048 },
      (error, publicKey, privateKey) => {
        if (error) reject(error);
        else resolve({ publicKey, privateKey });
      },
    ),
  );
  const exported = publicKey.export({ format: 'jwk' });
  if (typeof exported.n !== 'string' || typeof exported.e !== 'string')
    throw new Error('RSA public key export failed');
  return {
    privateKey,
    jwk: Object.freeze({
      kty: 'RSA',
      n: exported.n,
      e: exported.e,
      alg: 'RS256',
      use: 'sig',
      kid: randomUUID(),
    }),
  };
}

/**
 * Test-only RS256 compact serialization using Node/OpenSSL primitives.
 * No verifier, principal, network, file writes or production provider.
 * Private KeyObject stays inside this closure, never exported or serialized.
 */
export async function createRs256Fixture(): Promise<Rs256Fixture> {
  let active: Awaited<ReturnType<typeof generateFixtureKey>> | undefined =
    await generateFixtureKey();
  const published = new Map<string, PublicRsaJwk>([
    [active.jwk.kid, active.jwk],
  ]);
  let disposed = false;
  return Object.freeze({
    sign(claims, header) {
      if (!active || disposed) throw new Error('Test signer has been disposed');
      const protectedHeader = Buffer.from(
        JSON.stringify({
          alg: 'RS256',
          typ: header?.typ ?? 'at+jwt',
          kid: header?.kid ?? active.jwk.kid,
        }),
      ).toString('base64url');
      const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
      const input = `${protectedHeader}.${payload}`;
      const signature = sign('RSA-SHA256', Buffer.from(input), {
        key: active.privateKey,
        padding: constants.RSA_PKCS1_PADDING,
      }).toString('base64url');
      return `${input}.${signature}`;
    },
    getJwks() {
      return Object.freeze({ keys: Object.freeze([...published.values()]) });
    },
    async rotate() {
      if (disposed) throw new Error('Test signer has been disposed');
      const next = await generateFixtureKey();
      if (disposed) throw new Error('Test signer has been disposed');
      published.set(next.jwk.kid, next.jwk);
      active = next;
      return next.jwk.kid;
    },
    retire(kid) {
      if (disposed) throw new Error('Test signer has been disposed');
      if (kid === active?.jwk.kid)
        throw new Error('Cannot retire the active test key');
      published.delete(kid);
    },
    dispose() {
      disposed = true;
      active = undefined;
      published.clear();
    },
  } satisfies Rs256Fixture);
}
