import { createAuthenticatedPrincipal } from '../principal/authenticated-principal.js';
import {
  PAYMENT_PERMISSIONS,
  isPaymentPermission,
} from './payment-permissions.js';
import { hasAllPaymentPermissions } from './permissions-evaluator.js';

describe('Exact payment permission evaluation, not JWT verification', () => {
  const principal = (permissions: string[]) =>
    createAuthenticatedPrincipal({
      issuer: 'fixture',
      subject: 'opaque',
      clientId: 'fixture',
      kind: 'USER',
      permissions: new Set(permissions),
      expiresAt: 2000000000,
    });

  it.each([
    [['payment:read'], ['payment:read'], true],
    [[], ['payment:read'], false],
    [['payment:create'], ['payment:read'], false],
    [['payment:read-extra'], ['payment:read'], false],
    [['payment:READ'], ['payment:read'], false],
    [['payment:read'], ['Payment:read'], false],
    [['payment:read', 'payment:create'], ['payment:read'], true],
    [
      ['payment:read', 'payment:create'],
      ['payment:read', 'payment:create'],
      true,
    ],
    [['payment:read'], ['payment:read', 'payment:create'], false],
    [['payment:read'], [], false],
    [['*', 'payment:*'], ['payment:simulate'], false],
    [['*'], ['*'], false],
    [['ADMIN', 'OPERADOR', 'CLIENTE'], ['payment:simulate'], false],
    [['ADMIN'], ['ADMIN'], false],
    [['payment:create'], ['payment:detail:create'], false],
    [['payment:simulate'], ['payment:simulate'], true],
  ] as [string[], string[], boolean][])(
    'permissions %j, required %j => %s',
    (granted, required, expected) => {
      expect(hasAllPaymentPermissions(principal(granted), required)).toBe(
        expected,
      );
    },
  );

  it('denies absent principal or absent requirements', () => {
    expect(hasAllPaymentPermissions(undefined, ['payment:read'])).toBe(false);
    expect(hasAllPaymentPermissions(null, ['payment:read'])).toBe(false);
    expect(
      hasAllPaymentPermissions(principal(['payment:read']), undefined),
    ).toBe(false);
  });

  it('does not read role/body/query/header properties as grants', () => {
    const untrusted = {
      ...principal([]),
      roles: ['ADMIN'],
      body: { permissions: ['payment:simulate'] },
      query: { permissions: ['payment:simulate'] },
      headers: { permissions: ['payment:simulate'] },
    };
    expect(hasAllPaymentPermissions(untrusted, ['payment:simulate'])).toBe(
      false,
    );
  });

  it('freezes the catalog of proposed names without assigning grants', () => {
    expect(Object.values(PAYMENT_PERMISSIONS)).toEqual([
      'payment:read',
      'payment:create',
      'payment:detail:create',
      'payment:simulate',
    ]);
    expect(Object.isFrozen(PAYMENT_PERMISSIONS)).toBe(true);
    expect(isPaymentPermission('payment:read')).toBe(true);
    expect(isPaymentPermission('ADMIN')).toBe(false);
  });
});
