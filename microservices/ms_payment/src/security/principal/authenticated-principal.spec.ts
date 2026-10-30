import {
  createAuthenticatedPrincipal,
  type AuthenticatedPrincipal,
} from './authenticated-principal.js';

describe('AuthenticatedPrincipal snapshot (not authentication)', () => {
  function identity() {
    return {
      issuer: 'fixture-issuer',
      subject: 'opaque-subject',
      clientId: 'fixture-client',
      kind: 'USER' as const,
      permissions: new Set(['payment:read', 'payment:read']),
      expiresAt: 2000000000,
    };
  }

  it('freezes fields and snapshots a deduplicated permission set', () => {
    const input = identity();
    const principal = createAuthenticatedPrincipal(input);
    input.subject = 'changed';
    input.permissions.add('payment:simulate');
    expect(principal.subject).toBe('opaque-subject');
    expect(Object.isFrozen(principal)).toBe(true);
    expect(Reflect.set(principal, 'subject', 'changed')).toBe(false);
    expect([...principal.permissions]).toEqual(['payment:read']);
    expect(principal.permissions.size).toBe(1);
    expect(principal.permissions.has('payment:simulate')).toBe(false);
    expectTypeOf(principal.permissions).toEqualTypeOf<ReadonlySet<string>>();
  });

  it('exposes no mutable Set through its methods or forEach callback', () => {
    const permissions = createAuthenticatedPrincipal(identity()).permissions;
    expect(Object.isFrozen(permissions)).toBe(true);
    expect('add' in permissions).toBe(false);
    expect('delete' in permissions).toBe(false);
    expect('clear' in permissions).toBe(false);
    expect(() =>
      Set.prototype.add.call(permissions, 'payment:simulate'),
    ).toThrow(TypeError);
    const context = {};
    permissions.forEach(function (this: object, value, key, view) {
      expect(this).toBe(context);
      expect(value).toBe(key);
      expect(view).toBe(permissions);
    }, context);
    expect([...permissions.keys()]).toEqual(['payment:read']);
    expect([...permissions.values()]).toEqual(['payment:read']);
    expect([...permissions.entries()]).toEqual([
      ['payment:read', 'payment:read'],
    ]);
  });

  it('copies only minimal fields, excluding credentials, raw claims and ownership', () => {
    const input = {
      ...identity(),
      token: 'fixture-secret',
      authorization: 'fixture-secret',
      payload: {},
      password: 'fixture-secret',
      privateKey: 'fixture-secret',
      bank: 'fixture-secret',
      tenantId: 'not-approved',
      orderId: '42',
      userId: '42',
    };
    const principal = createAuthenticatedPrincipal(input);
    expect(Object.keys(principal).sort()).toEqual(
      [
        'issuer',
        'subject',
        'clientId',
        'kind',
        'permissions',
        'expiresAt',
      ].sort(),
    );
    expect(JSON.stringify(principal)).not.toContain('fixture-secret');
    expectTypeOf<keyof AuthenticatedPrincipal>().toEqualTypeOf<
      'issuer' | 'subject' | 'clientId' | 'kind' | 'permissions' | 'expiresAt'
    >();
  });

  it('supports service identities without mapping subject to a database user', () => {
    const principal = createAuthenticatedPrincipal({
      ...identity(),
      kind: 'SERVICE',
    });
    expect(principal.kind).toBe('SERVICE');
    expect(principal.subject).toBe('opaque-subject');
    // Creating this value is possible without a credential; it is never proof of verification.
    expect(principal.expiresAt).toBe(2000000000);
  });
});
