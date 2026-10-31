import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { createPublicKey, createPrivateKey, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify, importJWK, createLocalJWKSet } from 'jose';
import type { JWK, JSONWebKeySet, JWTPayload } from 'jose';
import { AUTH_SETTINGS } from './auth.settings.js';
import type { AuthSettings } from './auth.settings.js';

export interface IdentityClaims extends JWTPayload {
  sub: string;
  sid: string;
  jti: string;
  token_use: 'access' | 'refresh';
  roles?: string[];
}
interface Keyring {
  activeKid: string;
  keys: Array<{ kid: string; publicJwk: JWK; privateJwk?: JWK }>;
}
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
@Injectable()
export class IdentityJwtService implements OnModuleInit {
  private privateKey!: Awaited<ReturnType<typeof importJWK>>;
  private keys!: ReturnType<typeof createLocalJWKSet>;
  private activeKid!: string;
  private publicSet: JSONWebKeySet = { keys: [] };
  constructor(@Inject(AUTH_SETTINGS) private readonly settings: AuthSettings) {}
  async onModuleInit(): Promise<void> {
    const source =
      this.settings.keyringJson ??
      (this.settings.keyringPath
        ? await readFile(this.settings.keyringPath, 'utf8')
        : undefined);
    if (!source) throw new Error('JWT keyring is not configured');
    const ring = JSON.parse(source) as Keyring;
    if (
      typeof ring.activeKid !== 'string' ||
      !Array.isArray(ring.keys) ||
      !ring.keys.length
    )
      throw new Error('Invalid keyring');
    const seen = new Set<string>();
    for (const entry of ring.keys) {
      if (
        typeof entry.kid !== 'string' ||
        !uuid.test(entry.kid) ||
        seen.has(entry.kid) ||
        entry.publicJwk.kty !== 'RSA'
      )
        throw new Error('Invalid keyring entry');
      seen.add(entry.kid);
      const key = createPublicKey({ key: entry.publicJwk, format: 'jwk' });
      if ((key.asymmetricKeyDetails?.modulusLength ?? 0) < 3072)
        throw new Error('RSA key too small');
      // Build the public set explicitly, never copying private parameters.
      const publicJwk = key.export({ format: 'jwk' });
      this.publicSet.keys.push({
        kty: 'RSA',
        n: publicJwk.n,
        e: publicJwk.e,
        alg: 'RS256',
        use: 'sig',
        kid: entry.kid,
      });
      if (entry.kid === ring.activeKid) {
        if (!entry.privateJwk) throw new Error('Active private key missing');
        const derived = createPublicKey(
          createPrivateKey({ key: entry.privateJwk, format: 'jwk' }),
        ).export({ format: 'jwk' });
        if (derived.n !== publicJwk.n || derived.e !== publicJwk.e)
          throw new Error('Key pair mismatch');
        this.privateKey = await importJWK(entry.privateJwk, 'RS256');
      }
    }
    if (!this.privateKey) throw new Error('Active key missing');
    this.activeKid = ring.activeKid;
    this.keys = createLocalJWKSet(this.publicSet);
  }
  jwks(): JSONWebKeySet {
    return structuredClone(this.publicSet);
  }
  async issue(
    sub: string,
    sid: string,
    roles: string[],
    sessionExpiration: Date,
  ) {
    const now = Math.floor(Date.now() / 1000);
    const refreshExp = Math.floor(sessionExpiration.getTime() / 1000);
    const accessExp = Math.min(now + this.settings.accessSeconds, refreshExp);
    const sign = (kind: 'access' | 'refresh', expiration: number) =>
      new SignJWT({
        sid,
        token_use: kind,
        ...(kind === 'access' ? { roles } : {}),
      })
        .setProtectedHeader({
          alg: 'RS256',
          typ: `identity-${kind}+jwt`,
          kid: this.activeKid,
        })
        .setIssuer(this.settings.issuer)
        .setAudience(
          kind === 'access'
            ? this.settings.accessAudience
            : this.settings.refreshAudience,
        )
        .setSubject(sub)
        .setJti(randomUUID())
        .setIssuedAt(now)
        .setExpirationTime(expiration)
        .sign(this.privateKey);
    return {
      access_token: await sign('access', accessExp),
      refresh_token: await sign('refresh', refreshExp),
      token_type: 'Bearer' as const,
      expires_in: accessExp - now,
      refresh_expires_at: sessionExpiration.toISOString(),
    };
  }
  async verify(
    token: string,
    kind: 'access' | 'refresh',
  ): Promise<IdentityClaims> {
    try {
      const { payload } = await jwtVerify(token, this.keys, {
        algorithms: ['RS256'],
        issuer: this.settings.issuer,
        audience:
          kind === 'access'
            ? this.settings.accessAudience
            : this.settings.refreshAudience,
        typ: `identity-${kind}+jwt`,
        clockTolerance: 0,
        requiredClaims: ['sub', 'sid', 'jti', 'iat', 'exp', 'token_use'],
      });
      if (
        typeof payload.sub !== 'string' ||
        !/^[1-9]\d{0,18}$/.test(payload.sub) ||
        BigInt(payload.sub) > 9223372036854775807n ||
        typeof payload.sid !== 'string' ||
        !uuid.test(payload.sid) ||
        typeof payload.jti !== 'string' ||
        !uuid.test(payload.jti) ||
        payload.token_use !== kind ||
        typeof payload.iat !== 'number' ||
        payload.iat > Math.floor(Date.now() / 1000) ||
        (kind === 'access' &&
          (!Array.isArray(payload.roles) ||
            !payload.roles.every((r: unknown) => typeof r === 'string')))
      )
        throw new Error('Invalid claims');
      return payload as IdentityClaims;
    } catch {
      throw new UnauthorizedException('Invalid or expired credentials.');
    }
  }
}
