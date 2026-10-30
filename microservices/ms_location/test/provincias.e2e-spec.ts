import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { ProvinciasController } from '../src/provincia/provincia.controller.js';
import { ProvinciaService } from '../src/provincia/provincia.service.js';

describe('Provincias (e2e)', () => {
  let app: INestApplication<App>;
  const provinciaService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProvinciasController],
      providers: [{ provide: ProvinciaService, useValue: provinciaService }],
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

  describe('GET /api/v1/provincias', () => {
    it('debe responder 200 con una lista', async () => {
      const provincias = [
        { prov_id: 1, prov_nombre: 'Azuay', prov_codigo: '01', reg_id: 1 },
      ];
      provinciaService.findAll.mockResolvedValue(provincias);

      const res = await request(app.getHttpServer())
        .get('/api/v1/provincias')
        .expect(200);

      expect(res.body).toEqual(provincias);
    });

    it('debe pasar el filtro opcional reg_id a la lista', async () => {
      provinciaService.findAll.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/v1/provincias?reg_id=1')
        .expect(200);

      expect(provinciaService.findAll).toHaveBeenCalledWith(1);
    });
  });

  describe('GET /api/v1/provincias/:id', () => {
    it('debe responder 404 cuando la provincia no existe', async () => {
      provinciaService.findOne.mockRejectedValue(
        new NotFoundException('Provincia no encontrada'),
      );

      await request(app.getHttpServer())
        .get('/api/v1/provincias/999')
        .expect(404);
    });
  });

  describe('POST /api/v1/provincias', () => {
    it('debe responder 201 y setear Location', async () => {
      const created = {
        prov_id: 1,
        reg_id: 1,
        prov_nombre: 'Azuay',
        prov_codigo: '01',
      };
      provinciaService.create.mockResolvedValue(created);

      const res = await request(app.getHttpServer())
        .post('/api/v1/provincias')
        .send({ reg_id: 1, prov_nombre: 'Azuay', prov_codigo: '01' })
        .expect(201);

      expect(res.body).toEqual(created);
      expect(res.headers.location).toBe('/api/v1/provincias/1');
    });
  });

  describe('PUT /api/v1/provincias/:id', () => {
    it('debe responder 204 sin contenido', async () => {
      provinciaService.update.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .put('/api/v1/provincias/1')
        .send({ prov_nombre: 'Azuay', prov_codigo: '01', reg_id: 1 })
        .expect(204);
    });
  });

  describe('PATCH /api/v1/provincias/:id', () => {
    it('debe responder 200 con el provincia actualizada', async () => {
      const updated = {
        prov_id: 1,
        prov_nombre: 'Azuay',
        prov_codigo: '01',
        reg_id: 1,
      };
      provinciaService.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/api/v1/provincias/1')
        .send({ prov_nombre: 'Azuay' })
        .expect(200);

      expect(res.body).toEqual(updated);
    });
  });

  describe('DELETE /api/v1/provincias/:id', () => {
    it('debe responder 204 sin contenido', async () => {
      provinciaService.remove.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete('/api/v1/provincias/1')
        .expect(204);
    });
  });
});
