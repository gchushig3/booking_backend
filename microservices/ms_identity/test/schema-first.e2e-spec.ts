import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { BookingApiKeyGuard } from '@booking/infrastructure';
import { AuthController } from '../src/auth/auth.controller.js';
import { BookingConsumerController } from '../src/auth/booking-consumer.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { configureApplication } from '../src/configure-application.js';

describe('Schema-first y consumidores Booking', () => {
  let app: INestApplication<Server>;
  const key = 'booking-unit-test-key-with-at-least-32-characters';
  const auth = {
    register: jest.fn(() => ({ id: '1' })),
    login: jest
      .fn<
        (...args: Parameters<AuthService['login']>) => { access_token: string }
      >()
      .mockReturnValue({ access_token: 'signed-token' }),
    authenticate: jest.fn(() => ({
      userId: '1',
      sessionId: 'session',
      roles: ['ADMIN'],
    })),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController, BookingConsumerController],
      providers: [
        { provide: AuthService, useValue: auth },
        {
          provide: ConfigService,
          useValue: new ConfigService({ BOOKING_API_KEY: key }),
        },
        BookingApiKeyGuard,
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

  it('rechaza escalamiento de roles y tipos incorrectos antes de llamar register/login', async () => {
    await request(app.getHttpServer())
      .post('/api/v2/auth/register')
      .send({
        email: 'a@example.com',
        password: 'safe-password-123',
        first_name: 'Ana',
        last_name: 'Test',
        roles: ['ADMIN'],
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v2/auth/login')
      .send({ email: 'a@example.com', password: 123 })
      .expect(400);
    expect(auth.register).not.toHaveBeenCalled();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('conserva normalizacion de correo y entrega el resultado JWT del servicio', async () => {
    await request(app.getHttpServer())
      .post('/api/v2/auth/login')
      .send({ email: ' ANA@EXAMPLE.COM ', password: 'safe-password-123' })
      .expect(200);
    expect(auth.login).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@example.com' }),
      expect.anything(),
    );
  });

  it('introspeccion exige API Key antes de validar el JWT', async () => {
    await request(app.getHttpServer())
      .post('/api/v2/auth/booking/introspect')
      .send({ access_token: 'x' })
      .expect(401);
    expect(auth.authenticate).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post('/api/v2/auth/booking/introspect')
      .set('X-API-Key', key)
      .send({ access_token: 'x', role: 'ADMIN' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v2/auth/booking/introspect')
      .set('X-API-Key', key)
      .send({ access_token: 'x' })
      .expect(200, { userId: '1', sessionId: 'session', roles: ['ADMIN'] });
  });
});
