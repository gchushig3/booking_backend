/** Preparatory internal API only. Importing it does not activate security. */
export { createAuthenticatedPrincipal } from './principal/authenticated-principal.js';
export type {
  AuthenticatedPrincipal,
  PrincipalKind,
} from './principal/authenticated-principal.js';
export type {
  BearerCredential,
  JwtVerificationResult,
  JwtVerifierPort,
} from './jwt/jwt-verifier.port.js';
export type { VerifiedAccessToken } from './jwt/verified-access-token.js';
export {
  PAYMENT_PERMISSIONS,
  isPaymentPermission,
} from './permissions/payment-permissions.js';
export type { PaymentPermission } from './permissions/payment-permissions.js';
export { hasAllPaymentPermissions } from './permissions/permissions-evaluator.js';
export {
  isPaymentResource,
  paymentResource,
  orderResource,
} from './policy/payment-resource.js';
export type { PaymentResource } from './policy/payment-resource.js';
export type {
  ResourcePolicyRequest,
  ResourcePolicyDecision,
  ResourcePolicyPort,
} from './policy/resource-policy.port.js';
export { evaluatePaymentResourceAccess } from './policy/resource-policy-evaluator.js';
