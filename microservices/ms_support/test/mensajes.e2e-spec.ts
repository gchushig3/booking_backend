import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { IdentityAccessGuard } from '@booking/infrastructure';
import request from 'supertest';
import { MensajesController } from '../src/mensaje/mensaje.controller.js';
import { MensajeService } from '../src/mensaje/mensaje.service.js';

const valid = {
  men_nombre: 'Ana',
  men_correo: 'ana@example.com',
  men_asunto: 'Pago',
  men_cuerpo: 'Hola',
};

const guardFor = (roles: string[]) =>
  class {
    canActivate(context: {
      switchToHttp(): { getRequest(): Record<string, unknown> };
    }) {
      context.switchToHttp().getRequest().principal = {
        userId: '7',
        sessionId: 's',
        roles,
      };
      return true;
    }
  };

async function createApp(guard: unknown, service: object) {
  const module = await Test.createTestingModule({
    controllers: [MensajesController],
    providers: [
      { provide: MensajeService, useValue: service },
      { provide: ConfigService, useValue: new ConfigService({}) },
      { provide: APP_GUARD, useClass: guard as never },
    ],
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v2');
  await app.init();
  return app;
}

describe('support/messages (e2e)', () => {
  const service = {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    markRead: vi.fn(),
    remove: vi.fn(),
  };
  let app: INestApplication;
  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('rechaza peticiones sin JWT con 401', async () => {
    app = await createApp(IdentityAccessGuard, service);
    await request(app.getHttpServer())
      .post('/api/v2/support/messages')
      .send(valid)
      .expect(401);
  });

  it('un usuario autenticado crea mensajes con Location', async () => {
    app = await createApp(guardFor(['CLIENTE']), service);
    service.create.mockResolvedValue({ men_id: '5', ...valid });
    const res = await request(app.getHttpServer())
      .post('/api/v2/support/messages')
      .send(valid)
      .expect(201);
    expect(res.headers.location).toBe('/api/v2/support/messages/5');
  });

  it('valida el contrato JSON Schema del cuerpo', async () => {
    app = await createApp(guardFor(['CLIENTE']), service);
    await request(app.getHttpServer())
      .post('/api/v2/support/messages')
      .send({ ...valid, men_leido: true })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v2/support/messages')
      .send({ ...valid, men_correo: 'x' })
      .expect(400);
  });

  it('un administrador lista, filtra y marca como leido', async () => {
    app = await createApp(guardFor(['ADMIN']), service);
    service.list.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/v2/support/messages?leido=false')
      .expect(200);
    expect(service.list).toHaveBeenCalledWith(false);
    await request(app.getHttpServer())
      .get('/api/v2/support/messages?leido=maybe')
      .expect(400);
    service.markRead.mockResolvedValue({ men_id: '1', men_leido: true });
    await request(app.getHttpServer())
      .patch('/api/v2/support/messages/1')
      .send({ men_leido: true })
      .expect(200);
  });
});
