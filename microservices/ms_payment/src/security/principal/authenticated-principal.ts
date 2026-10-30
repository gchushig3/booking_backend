export type PrincipalKind = 'USER' | 'SERVICE';

/** Already verified identity. This model does not authenticate its constructor. */
export interface AuthenticatedPrincipal {
  readonly issuer: string;
  /** Opaque identity; not an Order ID or necessarily Identity.usu_id. */
  readonly subject: string;
  readonly clientId: string;
  readonly kind: PrincipalKind;
  readonly permissions: ReadonlySet<string>;
  /** Unix time in seconds, not milliseconds. Verification is the caller's job. */
  readonly expiresAt: number;
}

/** Snapshot without exposing a mutable Set, even through forEach's third arg. */
function immutablePermissions(values: Iterable<string>): ReadonlySet<string> {
  const snapshot = new Set(values);
  const view: ReadonlySet<string> = Object.freeze({
    size: snapshot.size,
    has: (value: string) => snapshot.has(value),
    entries: () => snapshot.entries(),
    keys: () => snapshot.keys(),
    values: () => snapshot.values(),
    [Symbol.iterator]: () => snapshot.values(),
    forEach: (
      callback: (value: string, key: string, set: ReadonlySet<string>) => void,
      thisArg?: unknown,
    ) => {
      snapshot.forEach((value) => callback.call(thisArg, value, value, view));
    },
  });
  return view;
}

/**
 * Copies only approved identity fields. No token/claims mapping or verification.
 * Manually constructing this object is NOT proof of authentication.
 */
export function createAuthenticatedPrincipal(
  identity: AuthenticatedPrincipal,
): AuthenticatedPrincipal {
  return Object.freeze({
    issuer: identity.issuer,
    subject: identity.subject,
    clientId: identity.clientId,
    kind: identity.kind,
    permissions: immutablePermissions(identity.permissions),
    expiresAt: identity.expiresAt,
  });
}
