import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { CuponesController } from '../src/cupon/cupon.controller.js';
import { CuponService } from '../src/cupon/cupon.service.js';

describe('Cupones (e2e)', () => {
  let app: INestApplication<App>;
  const cuponService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    findByCodigo: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CuponesController],
      providers: [{ provide: CuponService, useValue: cuponService }],
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

  describe('GET /api/v1/cupones', () => {
    it('debe responder 200 con una lista', async () => {
      const cupones = [
        {
          cup_id: 1,
          cup_codigo: 'DESCUENTO10',
          cup_tipo: 'PORCENTAJE',
          cup_valor: 10,
        },
      ];
      cuponService.findAll.mockResolvedValue(cupones);

      const res = await request(app.getHttpServer())
        .get('/api/v1/cupones')
        .expect(200);

      expect(res.body).toEqual(cupones);
    });
  });

  describe('GET /api/v1/cupones/codigo/:cupCodigo', () => {
    it('debe responder 200 cuando el cupon existe', async () => {
      const cupon = {
        cup_id: 1,
        cup_codigo: 'DESCUENTO10',
        cup_tipo: 'PORCENTAJE',
        cup_valor: 10,
      };
      cuponService.findByCodigo.mockResolvedValue(cupon);

      const res = await request(app.getHttpServer())
        .get('/api/v1/cupones/codigo/DESCUENTO10')
        .expect(200);

      expect(res.body).toEqual(cupon);
    });

    it('debe responder 404 cuando el cupon no existe', async () => {
      cuponService.findByCodigo.mockRejectedValue(
        new NotFoundException('Cupon no encontrado'),
      );

      await request(app.getHttpServer())
        .get('/api/v1/cupones/codigo/NOEXISTE')
        .expect(404);
    });
  });

  describe('GET /api/v1/cupones/:id', () => {
    it('debe responder 404 cuando el cupon no existe', async () => {
      cuponService.findOne.mockRejectedValue(
        new NotFoundException('Cupon no encontrado'),
      );

      await request(app.getHttpServer()).get('/api/v1/cupones/999').expect(404);
    });

    it('debe responder 400 cuando el id no es un numero', () => {
      return request(app.getHttpServer())
        .get('/api/v1/cupones/abc')
        .expect(400);
    });
  });

  describe('POST /api/v1/cupones', () => {
    it('debe responder 201 y setear Location', async () => {
      const created = {
        cup_id: 1,
        cup_codigo: 'DESCUENTO10',
        cup_tipo: 'PORCENTAJE',
        cup_valor: 10,
        cup_fecha_inicio: '2026-11-01',
      };
      cuponService.create.mockResolvedValue(created);

      const res = await request(app.getHttpServer())
        .post('/api/v1/cupones')
        .send({
          cup_codigo: 'DESCUENTO10',
          cup_tipo: 'PORCENTAJE',
          cup_valor: 10,
          cup_fecha_inicio: '2026-11-01',
        })
        .expect(201);

      expect(res.body).toEqual(created);
      expect(res.headers.location).toBe('/api/v1/cupones/1');
    });

    it('debe responder 400 cuando el body es invalido', () => {
      return request(app.getHttpServer())
        .post('/api/v1/cupones')
        .send({
          cup_codigo: '',
          cup_tipo: 'INVALIDO',
          cup_valor: 200,
          cup_fecha_inicio: 'no-es-fecha',
        })
        .expect(400);
    });
  });

  describe('PUT /api/v1/cupones/:id', () => {
    it('debe responder 204 sin contenido', async () => {
      cuponService.update.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .put('/api/v1/cupones/1')
        .send({
          cup_codigo: 'DESCUENTO10',
          cup_tipo: 'PORCENTAJE',
          cup_valor: 10,
          cup_fecha_inicio: '2026-11-01',
        })
        .expect(204);
    });
  });

  describe('PATCH /api/v1/cupones/:id', () => {
    it('debe responder 200 con el cupon actualizado', async () => {
      const updated = {
        cup_id: 1,
        cup_codigo: 'DESCUENTO10',
        cup_tipo: 'PORCENTAJE',
        cup_valor: 20,
        cup_fecha_inicio: '2026-11-01',
      };
      cuponService.update.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/api/v1/cupones/1')
        .send({ cup_valor: 20 })
        .expect(200);

      expect(res.body).toEqual(updated);
    });
  });

  describe('DELETE /api/v1/cupones/:id', () => {
    it('debe responder 204 sin contenido', async () => {
      cuponService.remove.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete('/api/v1/cupones/1')
        .expect(204);
    });
  });
});
