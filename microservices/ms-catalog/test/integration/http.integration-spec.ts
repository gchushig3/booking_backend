import 'reflect-metadata';
import { randomInt, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource, In } from 'typeorm';
import request from 'supertest';
import { configureApplication } from '../../src/configure-application.js';
import { configureOpenApi } from '../../src/common/openapi/configure-openapi.js';
import { validateEnvironment } from '../../src/config/environment.js';
import { applyCatalogSchema } from '../../src/database/apply-catalog-schema.js';
import {
  AtraccionEntity,
  AtraccionCategoriaEntity,
  AtraccionIdiomaEntity,
  AtraccionInclusionEntity,
  AtraccionFotoEntity,
  OperadorEntity,
  CategoriaEntity,
  IdiomaEntity,
  InclusionEntity,
} from '../../src/database/entities/index.js';
import type { AttractionResponseDto } from '../../src/modules/attractions/dto/attraction-response.dto.js';
import { AttractionsService } from '../../src/modules/attractions/attractions.service.js';
import type { PaginatedResponse } from '../../src/common/pagination/paginated-response.dto.js';

const env = validateEnvironment(process.env);
if (
  env.NODE_ENV !== 'test' ||
  env.DB_DATABASE !== 'ms_catalog_test' ||
  !['127.0.0.1', 'localhost'].includes(env.DB_HOST) ||
  env.DB_PORT !== 5445
) {
  throw new Error(
    'HTTP integration requires isolated ms_catalog_test on loopback:5445',
  );
}

describe('HTTP with real AppModule and PostgreSQL 16 (no service overrides)', () => {
  let app: INestApplication<Server> | undefined;
  let source: DataSource;
  let operatorId: string | undefined;
  let inclusionId: number | undefined;
  let categoryId: number;
  const attractions: AtraccionEntity[] = [];
  const prefix = `phase-g-${randomUUID()}`;

  beforeAll(async () => {
    // Dynamic import keeps configuration behind the isolated-database check above.
    const { AppModule } = await import('../../src/app.module.js');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>({
      logger: false,
    });
    configureApplication(app);
    configureOpenApi(app);
    await app.init();
    source = app.get(DataSource);
    const [target] = await source.query<
      Array<{ database: string; version: number }>
    >(
      "SELECT current_database() AS database,current_setting('server_version_num')::int AS version",
    );
    expect(target?.database).toBe('ms_catalog_test');
    expect(target?.version).toBeGreaterThanOrEqual(160000);
    expect(target?.version).toBeLessThan(170000);
    const tables = await source.query<unknown[]>(
      "SELECT tablename FROM pg_tables WHERE schemaname='public'",
    );
    if (!tables.length) {
      await applyCatalogSchema(
        source,
        await readFile(
          new URL('../../database/migrations/001-catalog.sql', import.meta.url),
          'utf8',
        ),
      );
    }
    // Committed fixtures are visible across HTTP connection-pool sessions, only in the test DB.
    await source.transaction(async (manager) => {
      const operator = await manager.save(OperadorEntity, {
        ope_codigo: randomInt(200000, 2000000000),
        ope_nombre: prefix,
        prov_id: 32766,
      });
      operatorId = operator.ope_id;
      const category = await manager.findOneByOrFail(CategoriaEntity, {
        cat_slug: 'aventura',
      });
      categoryId = category.cat_id;
      const language = await manager.findOneByOrFail(IdiomaEntity, {
        idi_codigo: 'es',
      });
      const inclusion = await manager.save(InclusionEntity, {
        inc_tipo: 'INCLUYE',
        inc_nombre: prefix,
      });
      inclusionId = inclusion.inc_id;
      for (const [index, state] of [
        'PUBLICADA',
        'PUBLICADA',
        'BORRADOR',
        'INACTIVA',
        'PUBLICADA',
      ].entries()) {
        attractions.push(
          await manager.save(AtraccionEntity, {
            ope_id: operatorId,
            ciu_id: 32766,
            atr_nombre: `${prefix} ${index}`,
            atr_slug: `${prefix}-${index}`,
            atr_descripcion: 'Fixture HTTP de integración',
            atr_tipo: 'GUIDED_TOUR',
            atr_estado: state,
            atr_latitud: '-0.220200',
            atr_longitud: '-78.512300',
            atr_duracion_horas: '2.50',
            atr_eliminado_en: index === 4 ? new Date() : null,
          }),
        );
      }
      const first = attractions[0];
      if (!first) throw new Error('Missing test fixture');
      await manager.insert(AtraccionCategoriaEntity, {
        atr_id: first.atr_id,
        cat_id: categoryId,
      });
      await manager.insert(AtraccionIdiomaEntity, {
        atr_id: first.atr_id,
        idi_id: language.idi_id,
      });
      await manager.insert(AtraccionInclusionEntity, {
        atr_id: first.atr_id,
        inc_id: inclusion.inc_id,
      });
      await manager.save(
        AtraccionFotoEntity,
        [2, 1].map((order) => ({
          atr_id: first.atr_id,
          fot_url: `https://example.com/test-${order}.jpg`,
          fot_alt: `Fixture ${order}`,
          fot_orden: order,
        })),
      );
    });
  });

  afterAll(async () => {
    try {
      if (source?.isInitialized) {
        // Delete only IDs created by this suite, never truncate or reset original seeds.
        if (attractions.length)
          await source
            .getRepository(AtraccionEntity)
            .delete({ atr_id: In(attractions.map((a) => a.atr_id)) });
        if (inclusionId !== undefined)
          await source.getRepository(InclusionEntity).delete(inclusionId);
        if (operatorId !== undefined)
          await source.getRepository(OperadorEntity).delete(operatorId);
        if (operatorId !== undefined)
          expect(
            await source
              .getRepository(OperadorEntity)
              .findOneBy({ ope_id: operatorId }),
          ).toBeNull();
      }
    } finally {
      await app?.close();
    }
  });

  function server(): Server {
    if (!app) throw new Error('Application not initialized');
    return app.getHttpServer();
  }

  it('filters visibility and paginates the real joined query', async () => {
    const response = await request(server())
      .get('/api/v2/atracciones')
      .query({ operator_id: operatorId, page: 1, limit: 1 })
      .expect(200);
    const body = response.body as PaginatedResponse<AttractionResponseDto>;
    expect(body).toMatchObject({ total: 2, page: 1, limit: 1, total_pages: 2 });
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe(attractions[1]?.atr_id);
    const page = await request(server())
      .get('/api/v2/atracciones')
      .query({ operator_id: operatorId, page: 2, limit: 1 })
      .expect(200);
    expect(
      (page.body as PaginatedResponse<AttractionResponseDto>).items[0]?.id,
    ).toBe(attractions[0]?.atr_id);
  });

  it.each(['id', 'uuid', 'slug'] as const)(
    'returns actual detail by %s',
    async (kind) => {
      const first = attractions[0];
      if (!first) throw new Error('Missing fixture');
      const identifier =
        kind === 'id'
          ? first.atr_id
          : kind === 'uuid'
            ? first.atr_uuid
            : first.atr_slug;
      const response = await request(server())
        .get(`/api/v2/atracciones/${identifier}`)
        .set('X-Correlation-Id', 'cid-real-postgres')
        .expect(200);
      const body = response.body as AttractionResponseDto;
      expect(body).toMatchObject({
        id: first.atr_id,
        duration_hours: 2.5,
        latitude: -0.2202,
        longitude: -78.5123,
      });
      expect(body.operator?.id).toBe(operatorId);
      expect(body.categories?.map((category) => category.id)).toEqual([
        categoryId,
      ]);
      expect(body.languages?.map((language) => language.code)).toEqual(['es']);
      expect(body.inclusions?.map((inclusion) => inclusion.id)).toEqual([
        inclusionId,
      ]);
      expect(body.photos?.map((photo) => photo.order)).toEqual([1, 2]);
      expect(response.headers['x-correlation-id']).toBe('cid-real-postgres');
    },
  );

  it.each([2, 3, 4])(
    'hides unpublished or deleted fixture %s',
    async (index) => {
      const response = await request(server())
        .get(`/api/v2/atracciones/${attractions[index]?.atr_slug}`)
        .expect(404);
      expect(response.headers['content-type']).toContain(
        'application/problem+json',
      );
      expect(response.body).toMatchObject({
        status: 404,
        code: 'ATTRACTION_NOT_FOUND',
      });
    },
  );

  it.each([{ category_id: true }, { category_slug: true }])(
    'searches own category data: %j',
    async (filter) => {
      const response = await request(server())
        .post('/api/v2/atracciones/search')
        .send({
          query: prefix,
          city_id: 32766,
          type: 'GUIDED_TOUR',
          ...(filter.category_id
            ? { category_id: categoryId }
            : { category_slug: 'aventura' }),
        })
        .expect(200);
      const body = response.body as PaginatedResponse<AttractionResponseDto>;
      expect(body.total).toBe(1);
      expect(body.items[0]?.id).toBe(attractions[0]?.atr_id);
    },
  );

  it('rejects invalid search inputs before the actual database service', async () => {
    const response = await request(server())
      .post('/api/v2/atracciones/search')
      .send({ limit: 101, price: 10 })
      .expect(400);
    expect(response.body).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('returns 404 instead of SQL overflow for an out-of-range numeric identifier', async () => {
    const response = await request(server())
      .get('/api/v2/atracciones/9223372036854775808')
      .expect(404);
    expect(response.body).toMatchObject({ code: 'ATTRACTION_NOT_FOUND' });
  });

  it('uses the same safe lookup in the internal administrative service without opening HTTP access', async () => {
    const service = app?.get(AttractionsService);
    if (!service || !attractions[0]) throw new Error('Missing service/fixture');
    expect((await service.findById(attractions[0].atr_id)).atr_id).toBe(
      attractions[0].atr_id,
    );
    await expect(service.findById('9223372036854775808')).rejects.toMatchObject(
      { status: 404 },
    );
  });

  it('keeps administration closed without inserting a resource', async () => {
    const before = await source
      .getRepository(AtraccionEntity)
      .count({ withDeleted: true });
    for (const token of ['', 'Bearer forged']) {
      await request(server())
        .post('/api/v2/atracciones')
        .set('Authorization', token)
        .send({ name: 'Unauthorized fixture' })
        .expect(401);
    }
    expect(
      await source.getRepository(AtraccionEntity).count({ withDeleted: true }),
    ).toBe(before);
  });

  it.each([{ featured: 'invalid' }, { city_id: 'invalid' }])(
    'returns 400 for invalid optional search filter %j',
    async (body) => {
      const response = await request(server())
        .post('/api/v2/atracciones/search')
        .send(body)
        .expect(400);
      expect(response.body).toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    },
  );

  it.each(['featured=invalid', 'city_id=invalid'])(
    'returns 400 for invalid optional query %s',
    async (query) => {
      const response = await request(server())
        .get(`/api/v2/atracciones?${query}`)
        .expect(400);
      expect(response.body).toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    },
  );

  it('serves Swagger with all real modules and explicit blocked administration', async () => {
    await request(server()).get('/api/docs').expect(200);
    const response = await request(server()).get('/api/docs-yaml').expect(200);
    expect(response.text).toContain('x-admin-blocked: true');
    expect(response.text).toBe(await readFile('docs/openapi.yaml', 'utf8'));
  });
});
