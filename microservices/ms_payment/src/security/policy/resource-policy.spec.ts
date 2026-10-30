import { createAuthenticatedPrincipal } from '../principal/authenticated-principal.js';
import {
  orderResource,
  paymentResource,
  isPaymentResource,
} from './payment-resource.js';
import { evaluatePaymentResourceAccess } from './resource-policy-evaluator.js';
import type {
  ResourcePolicyDecision,
  ResourcePolicyPort,
  ResourcePolicyRequest,
} from './resource-policy.port.js';
import type { PaymentResource } from './payment-resource.js';

describe('Resource policy boundaries, no real ownership adapter', () => {
  const principal = createAuthenticatedPrincipal({
    issuer: 'fixture',
    subject: 'opaque',
    clientId: 'fixture',
    kind: 'USER',
    permissions: new Set(['payment:read']),
    expiresAt: 2000000000,
  });
  const request: ResourcePolicyRequest = {
    principal,
    action: 'payment:read',
    resource: paymentResource('9200000000000000000'),
  };

  it.each([
    { status: 'ALLOW' },
    { status: 'DENY', reason: 'RESOURCE_ACCESS_DENIED' },
    { status: 'DENY', reason: 'NO_TRUSTED_SCOPE' },
    { status: 'POLICY_UNAVAILABLE' },
  ] satisfies ResourcePolicyDecision[])(
    'preserves explicit outcome %j from an isolated test double',
    async (decision) => {
      const evaluate = vi
        .fn<ResourcePolicyPort['evaluate']>()
        .mockResolvedValueOnce(decision);
      expect(
        await evaluatePaymentResourceAccess(request, { evaluate }),
      ).toEqual(decision);
      expect(evaluate).toHaveBeenCalledWith(request);
    },
  );

  it('denies when no policy exists, even with valid permission and BigId', async () => {
    expect(await evaluatePaymentResourceAccess(request)).toEqual({
      status: 'DENY',
      reason: 'POLICY_NOT_CONFIGURED',
    });
  });

  it('treats policy exceptions as unavailable, never allows or exposes their message', async () => {
    const policy: ResourcePolicyPort = {
      evaluate: vi
        .fn()
        .mockRejectedValueOnce(new Error('sensitive dependency detail')),
    };
    expect(await evaluatePaymentResourceAccess(request, policy)).toEqual({
      status: 'POLICY_UNAVAILABLE',
    });
  });

  it('denies a missing or unexpected decision from a broken adapter', async () => {
    // Deliberately violate the port at the runtime boundary, without installing an adapter.
    const policy = {
      evaluate: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ status: 'UNKNOWN' }),
    };
    for (let index = 0; index < 2; index += 1) {
      expect(await evaluatePaymentResourceAccess(request, policy)).toEqual({
        status: 'DENY',
        reason: 'NO_TRUSTED_DECISION',
      });
    }
  });

  it('does not consult policy when permission is missing', async () => {
    const evaluate = vi.fn<ResourcePolicyPort['evaluate']>();
    expect(
      await evaluatePaymentResourceAccess(
        { ...request, action: 'payment:simulate' },
        { evaluate },
      ),
    ).toEqual({ status: 'DENY', reason: 'MISSING_PERMISSION' });
    expect(evaluate).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', '01', '9223372036854775808', 'abc', '', 42, null])(
    'rejects invalid resource ID %s without calling policy',
    async (id) => {
      expect(() => paymentResource(id)).toThrow(TypeError);
      expect(() => orderResource(id)).toThrow(TypeError);
      expect(isPaymentResource({ kind: 'ORDER', orderId: id })).toBe(false);
      const evaluate = vi.fn<ResourcePolicyPort['evaluate']>();
      // Deliberately violate the type to test the runtime boundary without coercion.
      const resource = {
        kind: 'PAYMENT',
        paymentId: id,
      } as unknown as PaymentResource;
      expect(
        await evaluatePaymentResourceAccess(
          { ...request, resource },
          { evaluate },
        ),
      ).toEqual({ status: 'DENY', reason: 'INVALID_RESOURCE' });
      expect(evaluate).not.toHaveBeenCalled();
    },
  );

  it('keeps PAYMENT and ORDER IDs as immutable exact strings, not subjects', () => {
    const payment = paymentResource('9223372036854775807');
    const order = orderResource('9007199254740993');
    expect(payment).toEqual({
      kind: 'PAYMENT',
      paymentId: '9223372036854775807',
    });
    expect(order).toEqual({ kind: 'ORDER', orderId: '9007199254740993' });
    expect(Object.isFrozen(payment)).toBe(true);
    expect(Object.isFrozen(order)).toBe(true);
    expect(isPaymentResource(null)).toBe(false);
    expect(isPaymentResource({ kind: 'USER', orderId: '42' })).toBe(false);
    expect('subject' in order).toBe(false);
  });
});
