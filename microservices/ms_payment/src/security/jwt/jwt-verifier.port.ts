import type { VerifiedAccessToken } from './verified-access-token.js';

/** Extracted compact Bearer credential; excludes the Authorization scheme. */
export interface BearerCredential {
  readonly compactToken: string;
}

/** Domain outcomes only: these do not assign HTTP statuses or alter OpenAPI. */
export type JwtVerificationResult =
  | { readonly status: 'VERIFIED'; readonly token: VerifiedAccessToken }
  | { readonly status: 'INVALID_CREDENTIAL' }
  | { readonly status: 'VERIFICATION_UNAVAILABLE' };

/**
 * No concrete verifier/provider is supplied or registered.
 * VERIFIED requires a valid asymmetric signature and all claims/purpose checks
 * against independently configured trust, never token-selected issuer/JWKS.
 * Successful verification is not authorization or proof of resource ownership.
 */
export interface JwtVerifierPort {
  verify(credential: BearerCredential): Promise<JwtVerificationResult>;
}
