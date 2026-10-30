import { isBigIntId } from '../../common/validation/bigint-id.validation.js';

/** IDs remain canonical decimal strings; neither ID represents the user. */
export type PaymentResource =
  | { readonly kind: 'PAYMENT'; readonly paymentId: string }
  | { readonly kind: 'ORDER'; readonly orderId: string };

export function isPaymentResource(value: unknown): value is PaymentResource {
  if (typeof value !== 'object' || value === null || !('kind' in value))
    return false;
  return (
    (value.kind === 'PAYMENT' &&
      'paymentId' in value &&
      isBigIntId(value.paymentId)) ||
    (value.kind === 'ORDER' && 'orderId' in value && isBigIntId(value.orderId))
  );
}

export function paymentResource(paymentId: unknown): PaymentResource {
  if (!isBigIntId(paymentId))
    throw new TypeError('Payment resource requires a canonical BigId string');
  return Object.freeze({ kind: 'PAYMENT', paymentId });
}

export function orderResource(orderId: unknown): PaymentResource {
  if (!isBigIntId(orderId))
    throw new TypeError('Order resource requires a canonical BigId string');
  return Object.freeze({ kind: 'ORDER', orderId });
}
