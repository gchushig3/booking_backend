/** Test-only shapes. These are not an approved production issuer profile. */
export type TestJwtClaims = Readonly<Record<string, unknown>>;

export interface PublicRsaJwk {
  readonly kty: 'RSA';
  readonly n: string;
  readonly e: string;
  readonly alg: 'RS256';
  readonly use: 'sig';
  readonly kid: string;
}

export interface TestJwks {
  readonly keys: readonly PublicRsaJwk[];
}

export interface Rs256Fixture {
  sign(
    claims: TestJwtClaims,
    header?: { readonly kid?: string; readonly typ?: string },
  ): string;
  getJwks(): TestJwks;
  /** Prepublish a new public key; switch signing only when generation completes. */
  rotate(): Promise<string>;
  /** Remove a retired public key. Cannot remove the active signing key. */
  retire(kid: string): void;
  /** Release key references; no guarantee of zeroization in a JS runtime. */
  dispose(): void;
}
