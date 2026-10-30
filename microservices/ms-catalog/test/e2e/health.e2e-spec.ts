import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { configureApplication } from '../../src/configure-application.js';
import { HealthModule } from '../../src/health/health.module.js';

// Prueba HTTP de infraestructura: no incluye AppModule ni simula PostgreSQL.
describe('Sonda del proceso', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    configureApplication(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sirve la sonda bajo /api/v2', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v2/health/live')
      .expect(200);
    expect(response.body).toEqual({ status: 'UP' });
  });

  it('no publica una ruta de negocio antes de su implementación', async () => {
    await request(app.getHttpServer()).get('/api/v2/atracciones').expect(404);
  });
});
