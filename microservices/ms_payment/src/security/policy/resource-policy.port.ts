import type { PaymentPermission } from '../permissions/payment-permissions.js';
import type { AuthenticatedPrincipal } from '../principal/authenticated-principal.js';
import type { PaymentResource } from './payment-resource.js';

export interface ResourcePolicyRequest {
  readonly principal: AuthenticatedPrincipal;
  readonly action: PaymentPermission;
  readonly resource: PaymentResource;
}

export type ResourcePolicyDecision =
  | { readonly status: 'ALLOW' }
  | {
      readonly status: 'DENY';
      readonly reason:
        | 'NO_TRUSTED_SCOPE'
        | 'RESOURCE_ACCESS_DENIED'
        | 'POLICY_NOT_CONFIGURED'
        | 'NO_TRUSTED_DECISION'
        | 'INVALID_RESOURCE'
        | 'MISSING_PERMISSION';
    }
  | { readonly status: 'POLICY_UNAVAILABLE' };

/**
 * ALLOW must bind THIS principal/action/resource to a trusted access scope.
 * A permission, ord_id, role or missing policy cannot establish ownership.
 * No adapter, Identity/Order lookup or global-access fallback is provided.
 */
export interface ResourcePolicyPort {
  evaluate(request: ResourcePolicyRequest): Promise<ResourcePolicyDecision>;
}
