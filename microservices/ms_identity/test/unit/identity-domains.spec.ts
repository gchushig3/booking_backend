import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import {
  createIdentityDataSource,
  IDENTITY_DOMAINS,
} from '../../src/database/identity-domains.js';
import { IDENTITY_ENTITIES } from '../../src/database/entities/index.js';

describe('Identity persistence boundaries', () => {
  it.each(['synchronize', 'dropSchema', 'migrationsRun'] as const)(
    'rejects automatic DDL: %s',
    (flag) => {
      expect(() =>
        createIdentityDataSource({ type: 'postgres', [flag]: true }),
      ).toThrow();
    },
  );
  it('registers exactly five entities and one view with domain support isolated per source', () => {
    expect(IDENTITY_ENTITIES).toHaveLength(6);
    expect(IDENTITY_DOMAINS).toEqual([
      'dom_correo',
      'dom_documento',
      'dom_telefono',
    ]);
    const source = createIdentityDataSource({ type: 'postgres' });
    for (const domain of IDENTITY_DOMAINS)
      expect(source.driver.supportedDataTypes).toContain(domain);
    expect(source.isInitialized).toBe(false);
  });
});
