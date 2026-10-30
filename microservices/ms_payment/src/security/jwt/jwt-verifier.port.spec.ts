import type {
  BearerCredential,
  JwtVerificationResult,
  JwtVerifierPort,
} from './jwt-verifier.port.js';
import type { VerifiedAccessToken } from './verified-access-token.js';

describe('JWT verifier port conceptual outcomes (test double only)', () => {
  it('distinguishes verified data, invalid credential and unavailable dependency', async () => {
    const token: VerifiedAccessToken = {
      issuer: 'fixture',
      subject: 'opaque',
      clientId: 'fixture',
      audiences: ['fixture-payment'],
      expiresAt: 2000000000,
      permissionNames: new Set(['payment:read']),
    };
    const results: JwtVerificationResult[] = [
      { status: 'VERIFIED', token },
      { status: 'INVALID_CREDENTIAL' },
      { status: 'VERIFICATION_UNAVAILABLE' },
    ];
    const verify = vi
      .fn<JwtVerifierPort['verify']>()
      .mockResolvedValueOnce(results[0])
      .mockResolvedValueOnce(results[1])
      .mockResolvedValueOnce(results[2]);
    const port: JwtVerifierPort = { verify };
    const credential: BearerCredential = {
      compactToken: 'explicit-test-double-input-not-an-access-token',
    };
    for (const result of results)
      expect(await port.verify(credential)).toEqual(result);
    expect(verify).toHaveBeenCalledTimes(3);
    expect(Object.keys(token).sort()).toEqual(
      [
        'issuer',
        'subject',
        'clientId',
        'audiences',
        'expiresAt',
        'permissionNames',
      ].sort(),
    );
    expect('kind' in token).toBe(false); // Not a principal; identity classification remains external.
    expect('payload' in token).toBe(false);
    expectTypeOf<
      JwtVerifierPort['verify']
    >().returns.resolves.toEqualTypeOf<JwtVerificationResult>();
  });

  it('exports no concrete or permissive JWT verifier from the internal public API', async () => {
    const api = await import('../index.js');
    expect(
      Object.keys(api).some((key) =>
        /verifier|verifyJwt|verifyToken|AuthModule/i.test(key),
      ),
    ).toBe(false);
    expectTypeOf<VerifiedAccessToken>().not.toEqualTypeOf<BearerCredential>();
  });
});
