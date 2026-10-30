import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { IdentityAccessGuard } from '@booking/infrastructure';
import request from 'supertest';
import { ResenaController } from '../src/resena/resena.controller.js';
import { ResenaService } from '../src/resena/resena.service.js';

const valid = { atr_id: '12', ren_puntuacion: 5, ren_comentario: 'Genial' };

class FakeGuard {
  canActivate(context: {
    switchToHttp(): { getRequest(): Record<string, unknown> };
  }) {
    context.switchToHttp().getRequest().principal = {
      userId: '7',
      sessionId: 's',
      roles: ['CLIENTE'],
    };
    return true;
  }
}

async function createApp(guard: unknown, service: object) {
  const module = await Test.createTestingModule({
    controllers: [ResenaController],
    providers: [
      { provide: ResenaService, useValue: service },
      { provide: ConfigService, useValue: new ConfigService({}) },
      { provide: APP_GUARD, useClass: guard as never },
    ],
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v2');
  await app.init();
  return app;
}

describe('reviews (e2e)', () => {
  const service = {
    listVisible: vi.fn(),
    create: vi.fn(),
    setVisible: vi.fn(),
  };
  let app: INestApplication;
  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('la lectura es publica pero escribir exige JWT', async () => {
    app = await createApp(IdentityAccessGuard, service);
    service.listVisible.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/v2/reviews?atr_id=12')
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v2/reviews')
      .send(valid)
      .expect(401);
  });

  it('toma el autor del JWT y rechaza usu_id en el cuerpo', async () => {
    app = await createApp(FakeGuard, service);
    service.create.mockResolvedValue({ ren_id: '3', ...valid });
    await request(app.getHttpServer())
      .post('/api/v2/reviews')
      .send({ ...valid, usu_id: '99' })
      .expect(400);
    const res = await request(app.getHttpServer())
      .post('/api/v2/reviews')
      .send(valid)
      .expect(201);
    expect(res.headers.location).toBe('/api/v2/reviews/3');
    expect(service.create).toHaveBeenCalledWith('7', valid);
  });

  it('valida puntuacion y atr_id', async () => {
    app = await createApp(FakeGuard, service);
    for (const body of [
      { ...valid, ren_puntuacion: 6 },
      { ...valid, ren_puntuacion: 4.5 },
      { ...valid, atr_id: 'x' },
    ]) {
      await request(app.getHttpServer())
        .post('/api/v2/reviews')
        .send(body)
        .expect(400);
    }
    await request(app.getHttpServer()).get('/api/v2/reviews').expect(400);
  });
});
