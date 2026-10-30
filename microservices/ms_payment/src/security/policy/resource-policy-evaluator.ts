import { hasAllPaymentPermissions } from '../permissions/permissions-evaluator.js';
import { isPaymentResource } from './payment-resource.js';
import type {
  ResourcePolicyDecision,
  ResourcePolicyPort,
  ResourcePolicyRequest,
} from './resource-policy.port.js';

/** Internal composition only; not connected to HTTP, Nest providers or guards. */
export async function evaluatePaymentResourceAccess(
  request: ResourcePolicyRequest,
  policy?: ResourcePolicyPort,
): Promise<ResourcePolicyDecision> {
  if (!isPaymentResource(request.resource))
    return { status: 'DENY', reason: 'INVALID_RESOURCE' };
  if (!hasAllPaymentPermissions(request.principal, [request.action])) {
    return { status: 'DENY', reason: 'MISSING_PERMISSION' };
  }
  if (!policy) return { status: 'DENY', reason: 'POLICY_NOT_CONFIGURED' };
  try {
    const decision = await policy.evaluate(request);
    // Unknown/missing outcomes never become an allow through truthiness.
    if (
      decision?.status === 'ALLOW' ||
      decision?.status === 'DENY' ||
      decision?.status === 'POLICY_UNAVAILABLE'
    )
      return decision;
    return { status: 'DENY', reason: 'NO_TRUSTED_DECISION' };
  } catch {
    return { status: 'POLICY_UNAVAILABLE' };
  }
}
