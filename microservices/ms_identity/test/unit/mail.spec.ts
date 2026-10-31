import { describe, expect, it } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import { IdentityMailService } from '../../src/auth/mail.service.js';
import { AuthService } from '../../src/auth/auth.service.js';

const config = (identity: Record<string, unknown>) =>
  ({ getOrThrow: () => identity }) as unknown as ConfigService;

describe('Identity mail with SMTP disabled', () => {
  it('creates no transport and reports no delivery', async () => {
    const mail = new IdentityMailService(
      config({ SMTP_ENABLED: false, APP_ENV: 'production' }),
    );
    expect(mail.enabled).toBe(false);
    await expect(mail.send('a@example.test', 'EMAIL', 'secret')).resolves.toBe(
      false,
    );
    expect(() => mail.onModuleDestroy()).not.toThrow();
  });

  it('rejects verification and recovery requests without touching the database', async () => {
    const mail = new IdentityMailService(config({ SMTP_ENABLED: false }));
    const service = new AuthService(
      {} as never,
      {} as never,
      {} as never,
      mail,
      {} as never,
    );
    await expect(
      service.requestVerification('a@example.test', 'RECUPERACION'),
    ).rejects.toThrow('Email delivery is disabled.');
  });
});
