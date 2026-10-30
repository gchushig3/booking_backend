/** Names only, not grants. READ/CREATE/DETAIL_CREATE remain proposals. */
export const PAYMENT_PERMISSIONS = Object.freeze({
  READ: 'payment:read',
  CREATE: 'payment:create',
  DETAIL_CREATE: 'payment:detail:create',
  /** Already declared in Payment OpenAPI, still not enforced by JWT. */
  SIMULATE: 'payment:simulate',
} as const);

export type PaymentPermission =
  (typeof PAYMENT_PERMISSIONS)[keyof typeof PAYMENT_PERMISSIONS];

export function isPaymentPermission(value: string): value is PaymentPermission {
  return Object.values(PAYMENT_PERMISSIONS).some(
    (permission) => permission === value,
  );
}
