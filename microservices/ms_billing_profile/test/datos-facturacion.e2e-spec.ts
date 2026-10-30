import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { IdentityAccessGuard } from '@booking/infrastructure';
import request from 'supertest';
import { DatoFacturacionController } from '../src/dato-facturacion/dato-facturacion.controller.js';
import { DatoFacturacionService } from '../src/dato-facturacion/dato-facturacion.service.js';

const valid = {
  dfa_tipo_identificacion: 'CEDULA',
  dfa_identificacion: '0102030405',
  dfa_razon_social: 'Ana Perez',
  dfa_correo: 'ana@example.com',
};

async function createApp(guard: unknown, service: object) {
  const module = await Test.createTestingModule({
    controllers: [DatoFacturacionController],
    providers: [
      { provide: DatoFacturacionService, useValue: service },
      { provide: ConfigService, useValue: new ConfigService({}) },
      { provide: APP_GUARD, useClass: guard as never },
    ],
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v2');
  await app.init();
  return app;
}

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

describe('billing-profiles (e2e)', () => {
  const service = {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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
      .get('/api/v2/billing-profiles')
      .expect(401);
    expect(service.list).not.toHaveBeenCalled();
  });

  it('usa el usuario del JWT y nunca uno enviado en el cuerpo', async () => {
    app = await createApp(FakeGuard, service);
    service.create.mockResolvedValue({ dfa_id: '3', ...valid });
    await request(app.getHttpServer())
      .post('/api/v2/billing-profiles')
      .send({ ...valid, usu_id: '99' })
      .expect(400);
    const res = await request(app.getHttpServer())
      .post('/api/v2/billing-profiles')
      .send(valid)
      .expect(201);
    expect(res.headers.location).toBe('/api/v2/billing-profiles/3');
    expect(service.create).toHaveBeenCalledWith('7', valid);
  });

  it('valida el formato de identificacion segun el tipo', async () => {
    app = await createApp(FakeGuard, service);
    await request(app.getHttpServer())
      .post('/api/v2/billing-profiles')
      .send({ ...valid, dfa_identificacion: '123' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v2/billing-profiles')
      .send({ ...valid, dfa_correo: 'no-es-correo' })
      .expect(400);
  });

  it('valida ids y parches vacios', async () => {
    app = await createApp(FakeGuard, service);
    await request(app.getHttpServer())
      .get('/api/v2/billing-profiles/abc')
      .expect(400);
    await request(app.getHttpServer())
      .patch('/api/v2/billing-profiles/1')
      .send({})
      .expect(400);
    service.update.mockResolvedValue({ dfa_id: '1' });
    await request(app.getHttpServer())
      .patch('/api/v2/billing-profiles/1')
      .send({ dfa_razon_social: 'Nuevo' })
      .expect(200);
    expect(service.update).toHaveBeenCalledWith('7', '1', {
      dfa_razon_social: 'Nuevo',
    });
  });

  it('DELETE responde 204', async () => {
    app = await createApp(FakeGuard, service);
    service.remove.mockResolvedValue(undefined);
    await request(app.getHttpServer())
      .delete('/api/v2/billing-profiles/1')
      .expect(204);
  });
});
