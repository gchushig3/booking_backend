import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import type { Server } from 'node:http';
import request from 'supertest';
import { HealthController } from '../src/health/health.controller.js';
import { configureApplication } from '../src/configure-application.js';

describe('Phase B HTTP infrastructure (database test double)', () => {
  let app: INestApplication<Server>;
  let unavailable = false;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: DataSource,
          useValue: {
            query: async () => {
              if (unavailable) throw new Error('sensitive-fixture-marker');
              return [{ value: 1 }];
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>({
      logger: false,
    });
    configureApplication(app, ['http://localhost:5173']);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('exposes liveness without an access token and propagates correlation', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v2/health/live')
      .set('X-Correlation-Id', 'cid-identity-b')
      .expect(200);
    expect(response.body).toEqual({ status: 'UP' });
    expect(response.headers['x-correlation-id']).toBe('cid-identity-b');
  });
  it('generates a correlation identifier when omitted', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v2/health/live')
      .expect(200);
    expect(response.headers['x-correlation-id']).toMatch(/^[a-f0-9-]{36}$/);
  });
  it('reports readiness when the database probe succeeds', async () => {
    await request(app.getHttpServer()).get('/api/v2/health/ready').expect(200);
  });
  it('returns safe Problem Details when PostgreSQL is unavailable', async () => {
    unavailable = true;
    try {
      const response = await request(app.getHttpServer())
        .get('/api/v2/health/ready')
        .expect(503);
      expect(response.headers['content-type']).toContain(
        'application/problem+json',
      );
      expect(response.body).toMatchObject({
        status: 503,
        code: 'SERVICE_UNAVAILABLE',
      });
      expect(JSON.stringify(response.body)).not.toContain(
        'sensitive-fixture-marker',
      );
    } finally {
      unavailable = false;
    }
  });
  it('does not expose unimplemented authentication endpoints', async () => {
    await request(app.getHttpServer())
      .post('/api/v2/auth/login')
      .send({})
      .expect(404);
  });
  it('permits only configured browser origins', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/api/v2/health/live')
      .set('Origin', 'http://localhost:5173')
      .expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    const denied = await request(app.getHttpServer())
      .get('/api/v2/health/live')
      .set('Origin', 'https://unlisted.example')
      .expect(200);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
