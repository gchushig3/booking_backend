import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { CiudadesController } from '../src/ciudad/ciudad.controller.js';
import { CiudadService } from '../src/ciudad/ciudad.service.js';

describe('Ciudades (e2e)', () => {
  let app: INestApplication<App>;
  const ciudadService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CiudadesController],
      providers: [{ provide: CiudadService, useValue: ciudadService }],
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

  describe('GET /api/v1/ciudades', () => {
    it('debe responder 200 con una lista', async () => {
      const ciudades = [
        { ciu_id: 1, ciu_nombre: 'Cuenca', ciu_codigo: '010100', prov_id: 1 },
      ];
      ciudadService.findAll.mockResolvedValue(ciudades);

      const res = await request(app.getHttpServer())
        .get('/api/v1/ciudades')
        .expect(200);

      expect(res.body).toEqual(ciudades);
    });

    it('debe pasar el filtro opcional prov_id a la lista', async () => {
      ciudadService.findAll.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/v1/ciudades?prov_id=1')
        .expect(200);

      expect(ciudadService.findAll).toHaveBeenCalledWith(1);
    });
  });

  describe('GET /api/v1/ciudades/:id', () => {
    it('debe responder 404 cuando la ciudad no existe', async () => {
      ciudadService.findOne.mockRejectedValue(
        new NotFoundException('Ciudad no encontrada'),
      );

      await request(app.getHttpServer())
        .get('/api/v1/ciudades/999')
        .expect(404);
    });
  });

  describe('POST /api/v1/ciudades', () => {
    it('debe responder 201 y setear Location', async () => {
      const created = {
        ciu_id: 1,
        ciu_nombre: 'Cuenca',
        ciu_codigo: '010100',
        prov_id: 1,
      };
      ciudadService.create.mockResolvedValue(created);

      const res = await request(app.getHttpServer())
        .post('/api/v1/ciudades')
        .send({ ciu_nombre: 'Cuenca', ciu_codigo: '010100', prov_id: 1 })
        .expect(201);

      expect(res.body).toEqual(created);
      expect(res.headers.location).toBe('/api/v1/ciudades/1');
    });
  });

  describe('PUT /api/v1/ciudades/:id', () => {
    it('debe responder 204 sin contenido', async () => {
      ciudadService.update.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .put('/api/v1/ciudades/1')
        .send({ ciu_nombre: 'Cuenca', ciu_codigo: '010100', prov_id: 1 })
        .expect(204);
    });
  });

  describe('PATCH /api/v1/ciudades/:id', () => {
    it('debe responder 200 con la ciudad actualizada', async () => {
      const updated = {
        ciu_id: 1,
        ciu_nombre: 'Cuenca',
        ciu_codigo: '010100',
        prov_id: 1,
      };
      ciudadService.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/api/v1/ciudades/1')
        .send({ ciu_nombre: 'Cuenca' })
        .expect(200);

      expect(res.body).toEqual(updated);
    });
  });

  describe('DELETE /api/v1/ciudades/:id', () => {
    it('debe responder 204 sin contenido', async () => {
      ciudadService.remove.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete('/api/v1/ciudades/1')
        .expect(204);
    });
  });
});
