import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { RegionsController } from '../src/region/region.controller.js';
import { RegionService } from '../src/region/region.service.js';

describe('Regions (e2e)', () => {
  let app: INestApplication<App>;
  const regionService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RegionsController],
      providers: [{ provide: RegionService, useValue: regionService }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/regiones', () => {
    it('debe responder 200 con una lista', async () => {
      const regions = [{ reg_id: 1, reg_nombre: 'SIERRA', reg_codigo: 'SI' }];
      regionService.findAll.mockResolvedValue(regions);

      const res = await request(app.getHttpServer())
        .get('/api/v1/regiones')
        .expect(200);

      expect(res.body).toEqual(regions);
    });
  });

  describe('GET /api/v1/regiones/:id', () => {
    it('debe responder 200 cuando la region existe', async () => {
      const region = { reg_id: 1, reg_nombre: 'SIERRA', reg_codigo: 'SI' };
      regionService.findOne.mockResolvedValue(region);

      const res = await request(app.getHttpServer())
        .get('/api/v1/regiones/1')
        .expect(200);

      expect(res.body).toEqual(region);
    });

    it('debe responder 404 cuando la region no existe', async () => {
      regionService.findOne.mockRejectedValue(
        new NotFoundException('Region no encontrada'),
      );

      await request(app.getHttpServer())
        .get('/api/v1/regiones/999')
        .expect(404);
    });

    it('debe responder 400 cuando el id no es un numero', () => {
      return request(app.getHttpServer())
        .get('/api/v1/regiones/abc')
        .expect(400);
    });
  });

  describe('POST /api/v1/regiones', () => {
    it('debe responder 201 y setear Location', async () => {
      const created = { reg_id: 1, reg_nombre: 'SIERRA', reg_codigo: 'SI' };
      regionService.create.mockResolvedValue(created);

      const res = await request(app.getHttpServer())
        .post('/api/v1/regiones')
        .send({ reg_nombre: 'SIERRA', reg_codigo: 'SI' })
        .expect(201);

      expect(res.body).toEqual(created);
      expect(res.headers.location).toBe('/api/v1/regiones/1');
    });

    it('debe responder 400 cuando el body es invalido', () => {
      return request(app.getHttpServer())
        .post('/api/v1/regiones')
        .send({ reg_nombre: '', reg_codigo: 'si' })
        .expect(400);
    });
  });

  describe('PUT /api/v1/regiones/:id', () => {
    it('debe responder 204 sin contenido', async () => {
      regionService.update.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .put('/api/v1/regiones/1')
        .send({ reg_nombre: 'SIERRA', reg_codigo: 'SI' })
        .expect(204);
    });
  });

  describe('PATCH /api/v1/regiones/:id', () => {
    it('debe responder 200 con el region actualizado', async () => {
      const updated = { reg_id: 1, reg_nombre: 'SIERRA', reg_codigo: 'SI' };
      regionService.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/api/v1/regiones/1')
        .send({ reg_nombre: 'SIERRA' })
        .expect(200);

      expect(res.body).toEqual(updated);
    });
  });

  describe('DELETE /api/v1/regiones/:id', () => {
    it('debe responder 204 sin contenido', async () => {
      regionService.remove.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete('/api/v1/regiones/1')
        .expect(204);
    });
  });
});
