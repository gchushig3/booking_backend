/**
 * Minimal conceptual output of a FUTURE cryptographic verifier.
 * Field names are internal, not an approved wire-claim profile.
 * No roles/scope merging, raw payload, credentials, tenant or resource ownership.
 * An adapter must validate every attribute before returning VERIFIED.
 */
export interface VerifiedAccessToken {
  readonly issuer: string;
  readonly subject: string;
  readonly clientId: string;
  readonly audiences: readonly string[];
  /** Unix timestamp in seconds, validated by the future verifier. */
  readonly expiresAt: number;
  /** From ONE future approved claim source; no mapping exists in this phase. */
  readonly permissionNames: ReadonlySet<string>;
}
