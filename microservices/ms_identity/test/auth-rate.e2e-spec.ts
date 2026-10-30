import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Controller, Post, HttpCode } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import type { Server } from 'node:http';
import request from 'supertest';
import { Public, Throttle } from '../src/auth/auth.decorators.js';
import { AuthRateGuard } from '../src/auth/auth.guards.js';
import { AUTH_SETTINGS } from '../src/auth/auth.settings.js';
import { configureApplication } from '../src/configure-application.js';

// Only this test controller is a fixture; production rate guard and HTTP stack are used unchanged.
@Controller('rate-fixture')
class RateFixture {
  @Public()
  @Throttle('login')
  @Post('login')
  @HttpCode(200)
  login() {
    return { accepted: true };
  }
  @Public()
  @Throttle('recovery')
  @Post('forgot')
  @HttpCode(200)
  forgot() {
    return { accepted: true };
  }
}
describe('Authentication rate limits over HTTP', () => {
  let app: INestApplication<Server>;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [RateFixture],
      providers: [
        {
          provide: AUTH_SETTINGS,
          useValue: { loginLimit: 2, recoveryLimit: 1 },
        },
        { provide: APP_GUARD, useClass: AuthRateGuard },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>({
      logger: false,
    });
    configureApplication(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('limits attempts even when the caller changes account names and returns safe 429 with Retry-After', async () => {
    for (let n = 0; n < 2; n++)
      await request(app.getHttpServer())
        .post('/api/v2/rate-fixture/login')
        .send({ email: `unknown${n}@example.test` })
        .expect(200);
    const response = await request(app.getHttpServer())
      .post('/api/v2/rate-fixture/login')
      .send({ email: 'another@example.test' })
      .expect(429);
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(response.body.code).toBe('TOO_MANY_REQUESTS');
  });
  it('applies recovery limit independently of login', async () => {
    await request(app.getHttpServer())
      .post('/api/v2/rate-fixture/forgot')
      .send({ email: 'unknown@example.test' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v2/rate-fixture/forgot')
      .send({ email: 'unknown@example.test' })
      .expect(429);
  });
});
