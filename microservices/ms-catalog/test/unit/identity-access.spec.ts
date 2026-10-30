import 'reflect-metadata';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { AdministrativeAccessGuard } from '../../src/common/guards/administrative-access.guard.js';

describe('Autorizacion del catalogo mediante Identity', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  const config = new ConfigService({
    IDENTITY_BASE_URL: 'https://identity.example/api/v2',
    BOOKING_API_KEY: 'test-service-key',
  });
  const context = {
    getHandler: () => () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: 'Bearer aaa.bbb.ccc' } }),
    }),
  } as unknown as ExecutionContext;

  it('acepta ADMIN solo despues de introspeccion autenticada', async () => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ roles: ['ADMIN'] })));
    await expect(
      new AdministrativeAccessGuard(new Reflector(), config).canActivate(
        context,
      ),
    ).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://identity.example/api/v2/auth/booking/introspect',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'test-service-key',
        },
        body: JSON.stringify({ access_token: 'aaa.bbb.ccc' }),
      }),
    );
  });

  it('deniega CLIENTE y tokens revocados; falla cerrado si Identity no responde', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch');
    fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ roles: ['CLIENTE'] })),
    );
    await expect(
      new AdministrativeAccessGuard(new Reflector(), config).canActivate(
        context,
      ),
    ).rejects.toMatchObject({ status: 403 });
    fetch.mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(
      new AdministrativeAccessGuard(new Reflector(), config).canActivate(
        context,
      ),
    ).rejects.toMatchObject({ status: 401 });
    fetch.mockRejectedValueOnce(new Error('offline'));
    await expect(
      new AdministrativeAccessGuard(new Reflector(), config).canActivate(
        context,
      ),
    ).rejects.toMatchObject({ status: 503 });
  });
});
