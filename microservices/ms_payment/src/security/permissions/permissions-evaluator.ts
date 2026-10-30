import type { AuthenticatedPrincipal } from '../principal/authenticated-principal.js';
import { isPaymentPermission } from './payment-permissions.js';

/** Pure permission comparison only; never authenticates or checks ownership. */
export function hasAllPaymentPermissions(
  principal: AuthenticatedPrincipal | null | undefined,
  required: readonly string[] | undefined,
): boolean {
  return (
    principal != null &&
    required !== undefined &&
    required.length > 0 &&
    required.every(
      (permission) =>
        isPaymentPermission(permission) &&
        principal.permissions.has(permission),
    )
  );
}
