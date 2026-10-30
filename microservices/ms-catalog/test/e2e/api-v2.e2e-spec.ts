import { CatalogException } from '../../src/common/exceptions/catalog.exception.js';
import { BookingCatalogService } from '../../src/booking/booking-catalog.service.js';
import { CatalogEventsService } from '../../src/booking/catalog-events.service.js';
import { configureOpenApi } from '../../src/common/openapi/configure-openapi.js';
import type {
  OpenAPIObject,
  OperationObject,
  SchemaObject,
} from '@nestjs/swagger';
import { readFile } from 'node:fs/promises';
import { HealthController } from '../../src/health/health.controller.js';
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { configureApplication } from '../../src/configure-application.js';
import { AttractionsController } from '../../src/modules/attractions/attractions.controller.js';
import { CategoriesController } from '../../src/modules/categories/categories.controller.js';
import { LanguagesController } from '../../src/modules/languages/languages.controller.js';
import { InclusionsController } from '../../src/modules/inclusions/inclusions.controller.js';
import { OperatorsController } from '../../src/modules/operators/operators.controller.js';
import { AttractionsService } from '../../src/modules/attractions/attractions.service.js';
import { CategoriesService } from '../../src/modules/categories/categories.service.js';
import { LanguagesService } from '../../src/modules/languages/languages.service.js';
import { InclusionsService } from '../../src/modules/inclusions/inclusions.service.js';
import { OperatorsService } from '../../src/modules/operators/operators.service.js';

type MockFn = ReturnType<typeof jest.fn>;

interface TestPaginatedBody {
  items: Array<{ id: string; name: string }>;
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

interface TestCategoryTreeItem {
  id: string;
  nombre: string;
  subcategorias: unknown[];
}

interface TestLanguageItem {
  id: number;
  code: string;
  name: string;
}

describe('API REST /api/v2 (E2E HTTP)', () => {
  let app: INestApplication<Server>;
  let document: OpenAPIObject;

  const mockAttractionsService: Record<string, MockFn> = {
    findPublic: jest.fn().mockImplementation(() =>
      Promise.resolve({
        items: [
          {
            id: '1',
            uuid: 'c0a80101-0000-0000-0000-000000000001',
            name: 'Mitad del Mundo',
            slug: 'mitad-del-mundo',
            description: 'Monumento a la línea ecuatorial',
            short_description: null,
            address: null,
            meeting_point: null,
            type: 'GUIDED_TOUR',
            status: 'PUBLICADA',
            latitude: -0.002222,
            longitude: -78.455556,
            duration_hours: 4,
            currency: 'USD',
            city_id: 1,
            operator_id: '1',
            free_cancellation: true,
            cancellation_hours: 24,
            featured: true,
            average_rating: 4.8,
            reviews_count: 120,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        total_pages: 1,
      }),
    ),
    findPublicById: jest.fn().mockImplementation(async () => {
      const result =
        (await mockAttractionsService.findPublic?.()) as TestPaginatedBody;
      return result.items[0];
    }),
    searchPublic: jest.fn().mockImplementation(() =>
      Promise.resolve({
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        total_pages: 1,
      }),
    ),
    create: jest.fn(),
  };

  const mockCategoriesService: Record<string, MockFn> = {
    findTree: jest.fn().mockImplementation(() =>
      Promise.resolve([
        {
          id: 1,
          parent_id: null,
          name: 'Cultural',
          slug: 'cultural',
          description: null,
          icon: 'landmark',
          order: 1,
          active: true,
          children: [],
        },
      ]),
    ),
    findFlat: jest.fn().mockImplementation(() =>
      Promise.resolve([
        {
          id: 1,
          parent_id: null,
          name: 'Cultural',
          slug: 'cultural',
          description: null,
          icon: 'landmark',
          order: 1,
          active: true,
        },
      ]),
    ),
  };

  const mockLanguagesService: Record<string, MockFn> = {
    findAll: jest.fn().mockImplementation(() =>
      Promise.resolve([
        { id: 1, code: 'es', name: 'Español' },
        { id: 2, code: 'en', name: 'Inglés' },
      ]),
    ),
  };

  const mockInclusionsService: Record<string, MockFn> = {
    findAll: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve([
          { id: 1, type: 'INCLUYE', name: 'Guía bilingüe', order: 1 },
        ]),
      ),
  };

  const mockOperatorsService: Record<string, MockFn> = {
    findAll: jest.fn().mockImplementation(() =>
      Promise.resolve({
        items: [
          {
            id: '1',
            code: 100,
            name: 'Quito Tour Bus',
            province_id: 17,
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        total_pages: 1,
      }),
    ),
  };

  const card = {
    id: '1',
    name: 'Mitad del Mundo',
    city: 'Quito',
    duration: '4 horas',
    price: { currency: 'USD', adult: 20, child: 10, senior: 15, infant: 0 },
    rating: { score: 4.8, review_count: 120 },
    inclusions: {
      includes_food: false,
      includes_transport: true,
      includes_guide: true,
    },
  };
  const mockBooking = {
    search: jest.fn(async () => {
      await mockAttractionsService.searchPublic?.();
      return {
        data: [card],
        metadata: { total_results: 1, page: 1, limit: 10, total_pages: 1 },
      };
    }),
    detail: jest.fn(async () => {
      await mockAttractionsService.findPublicById?.();
      return {
        ...card,
        description: 'Tour',
        itinerary: [],
        meeting_point_geo: {
          address: 'Quito',
          city: 'Quito',
          latitude: -0.2,
          longitude: -78.5,
        },
        rating: {
          ...card.rating,
          breakdown: {
            limpieza: 9,
            servicio: 9,
            calidad_precio: 9,
            puntualidad: 9,
          },
        },
      };
    }),
    categories: jest.fn(async (_parent?: string, tree = false) => {
      if (tree) await mockCategoriesService.findTree?.();
      else await mockCategoriesService.findFlat?.({ active: true });
      return [
        {
          id: '1',
          nombre: 'Cultural',
          slug: 'cultural',
          incluye_comida: false,
          incluye_transporte: true,
          incluye_guia: true,
          ...(tree ? { subcategorias: [] } : {}),
        },
      ];
    }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        HealthController,
        CategoriesController,
        LanguagesController,
        InclusionsController,
        OperatorsController,
        AttractionsController,
      ],
      providers: [
        { provide: BookingCatalogService, useValue: mockBooking },
        {
          provide: CatalogEventsService,
          useValue: { consulted: jest.fn(() => Promise.resolve()) },
        },
        { provide: AttractionsService, useValue: mockAttractionsService },
        { provide: CategoriesService, useValue: mockCategoriesService },
        { provide: LanguagesService, useValue: mockLanguagesService },
        { provide: InclusionsService, useValue: mockInclusionsService },
        { provide: OperatorsService, useValue: mockOperatorsService },
      ],
    }).compile();

    app = module.createNestApplication<INestApplication<Server>>();
    configureApplication(app);
    document = configureOpenApi(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v2/atracciones responde 200 con paginación y cabecera X-Correlation-Id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v2/atracciones')
      .set('X-Correlation-Id', 'cid-test-request')
      .expect(200);

    expect(response.headers['x-correlation-id']).toBe('cid-test-request');
    const body = response.body as { data: Array<{ name: string }> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.name).toBe('Mitad del Mundo');
  });

  it('POST /api/v2/atracciones/search responde 200', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/atracciones/search')
      .send({ query: 'Quito', limit: 5 })
      .expect(200);

    const body = response.body as { data: Array<{ name: string }> };
    expect(body).toHaveProperty('data');
  });

  it('GET /api/v2/atracciones/categorias/arbol responde 200 con árbol de categorías', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v2/atracciones/categorias/arbol')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    const tree = response.body as TestCategoryTreeItem[];
    expect(tree[0]?.nombre).toBe('Cultural');
    expect(Array.isArray(tree[0]?.subcategorias)).toBe(true);
  });

  it('GET /api/v2/atracciones/categorias responde 200 plano', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v2/atracciones/categorias')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('GET /api/v2/idiomas responde 200 con lista de idiomas', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v2/idiomas')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    const languages = response.body as TestLanguageItem[];
    expect(languages).toHaveLength(2);
  });

  it('GET /api/v2/inclusiones responde 200 con lista de inclusiones', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v2/inclusiones')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('GET /api/v2/operadores está protegido', async () => {
    await request(app.getHttpServer()).get('/api/v2/operadores').expect(401);
    expect(mockOperatorsService.findAll).not.toHaveBeenCalled();
  });

  const administrativeRoutes = [
    ['post', '/api/v2/atracciones'],
    ['patch', '/api/v2/atracciones/1/estado'],
    ['put', '/api/v2/atracciones/1/categorias'],
    ['put', '/api/v2/atracciones/1/idiomas'],
    ['put', '/api/v2/atracciones/1/inclusiones'],
    ['post', '/api/v2/atracciones/1/fotos'],
    ['patch', '/api/v2/atracciones/1/fotos/1'],
    ['delete', '/api/v2/atracciones/1/fotos/1'],
    ['patch', '/api/v2/atracciones/1'],
    ['delete', '/api/v2/atracciones/1'],
    ['post', '/api/v2/atracciones/categorias'],
    ['patch', '/api/v2/atracciones/categorias/1'],
    ['delete', '/api/v2/atracciones/categorias/1'],
    ['get', '/api/v2/idiomas/1'],
    ['post', '/api/v2/idiomas'],
    ['patch', '/api/v2/idiomas/1'],
    ['delete', '/api/v2/idiomas/1'],
    ['get', '/api/v2/inclusiones/1'],
    ['post', '/api/v2/inclusiones'],
    ['patch', '/api/v2/inclusiones/1'],
    ['delete', '/api/v2/inclusiones/1'],
    ['get', '/api/v2/operadores'],
    ['get', '/api/v2/operadores/1'],
    ['post', '/api/v2/operadores'],
    ['patch', '/api/v2/operadores/1'],
    ['delete', '/api/v2/operadores/1'],
    ['get', '/api/v2/operadores/1/usuarios'],
    ['post', '/api/v2/operadores/1/usuarios'],
    ['patch', '/api/v2/operadores/1/usuarios/1'],
    ['delete', '/api/v2/operadores/1/usuarios/1'],
  ] as const;

  it.each(administrativeRoutes)(
    '%s %s deniega acceso antes del servicio',
    async (method, path) => {
      for (const authorization of [
        '',
        'Bearer invalid',
        'Bearer eyJhbGciOiJub25lIn0.eyJyb2xlIjoiQURNSU4ifQ.',
        'Basic admin',
      ]) {
        const client = request(app.getHttpServer());
        const response = await client[method](path)
          .set('Authorization', authorization)
          .set('X-Correlation-Id', 'cid-security')
          .send({ latitude: 999 })
          .expect(401);
        expect(response.headers['content-type']).toContain(
          'application/problem+json',
        );
        expect(response.body).toEqual(
          expect.objectContaining({
            status: 401,
            code: 'UNAUTHORIZED',
            correlation_id: 'cid-security',
          }),
        );
      }
      expect(mockAttractionsService.create).not.toHaveBeenCalled();
    },
  );

  it('las categorías públicas fuerzan active=true', async () => {
    await request(app.getHttpServer())
      .get('/api/v2/atracciones/categorias?active=false')
      .expect(200);
    expect(mockCategoriesService.findFlat).toHaveBeenLastCalledWith(
      expect.objectContaining({ active: true }),
    );
  });
  it('sirve Swagger UI y sus recursos en /api/docs', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs')
      .expect(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('swagger-ui');
    await request(app.getHttpServer())
      .get('/api/docs/swagger-ui-bundle.js')
      .expect(200);
    const init = await request(app.getHttpServer())
      .get('/api/docs/swagger-ui-init.js')
      .expect(200);
    expect(init.text.includes('SearchAtraccionesResponseV2')).toBe(true);
  });

  it('sirve el mismo OpenAPI JSON y YAML que el contrato exportado', async () => {
    const json = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    expect(json.body).toEqual(document);
    const yaml = await request(app.getHttpServer())
      .get('/api/docs-yaml')
      .expect(200);
    expect(yaml.text).toBe(await readFile('docs/openapi.yaml', 'utf8'));
    expect(document.openapi).toMatch(/^3\.0\./);
  });

  function operations(): OperationObject[] {
    return Object.values(document.paths).flatMap((item) =>
      (['get', 'post', 'put', 'patch', 'delete'] as const).flatMap((method) =>
        item[method] ? [item[method]] : [],
      ),
    );
  }

  it('documenta exactamente las rutas existentes bajo /api/v2 con IDs de operación ?nicos', () => {
    const all = operations();
    expect(all).toHaveLength(39);
    expect(new Set(all.map((operation) => operation.operationId)).size).toBe(
      all.length,
    );
    for (const [path, item] of Object.entries(document.paths)) {
      expect(path.startsWith('/api/v2/')).toBe(true);
      for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
        const operation = item[method];
        if (!operation) continue;
        expect(operation.summary).toBeTruthy();
        for (const match of path.matchAll(/\{(\w+)\}/g)) {
          expect(operation.parameters).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                name: match[1],
                in: 'path',
                required: true,
              }),
            ]),
          );
        }
      }
    }
  });

  it('todas las referencias de esquemas existen, incluso los contratos previstos', () => {
    function visit(value: unknown): void {
      if (!value || typeof value !== 'object') return;
      const record = value as Record<string, unknown>;
      if (typeof record.$ref === 'string') {
        expect(record.$ref.startsWith('#/components/schemas/')).toBe(true);
        expect(
          document.components?.schemas?.[record.$ref.split('/').at(-1) ?? ''],
        ).toBeDefined();
      }
      for (const nested of Object.values(record)) visit(nested);
    }
    visit(document);
  });

  it('documenta los handlers administrativos con JWT y errores de autorizacion', () => {
    const blocked = operations().filter(
      (operation) => operation.security?.length,
    );
    expect(blocked).toHaveLength(31);
    for (const operation of blocked) {
      expect(Object.keys(operation.responses)).toEqual(
        expect.arrayContaining(['401', '403', '503']),
      );
      expect(operation).not.toHaveProperty('x-admin-blocked');
      expect(operation).not.toHaveProperty('x-intended-responses');
      expect(operation.security).toEqual([{ jwt: [] }]);
    }
  });

  it('documenta Problem Details y correlación con los tipos de contenido reales', () => {
    for (const operation of operations()) {
      const header = operation.parameters?.find(
        (p) => 'name' in p && p.name === 'X-Correlation-Id',
      );
      expect(header).toEqual(
        expect.objectContaining({
          in: 'header',
          schema: { type: 'string', example: 'cid-example' },
        }),
      );
      for (const [status, response] of Object.entries(operation.responses)) {
        if (!response || '$ref' in response)
          throw new Error('Respuesta sin definición');
        expect(response.headers?.['X-Correlation-Id']).toBeDefined();
        if (Number(status) >= 400) {
          expect(
            response.content?.['application/problem+json']?.schema,
          ).toEqual({ $ref: '#/components/schemas/ProblemDetails' });
        } else if (Number(status) !== 204) {
          expect(response.content?.['application/json']?.schema).toBeDefined();
        }
      }
    }
  });

  function schema(name: string): SchemaObject {
    const value = document.components?.schemas?.[name];
    if (!value || '$ref' in value)
      throw new Error('Esquema inexistente: ' + name);
    return value;
  }

  it('expone entradas, validaciones, paginación y proyecciones de solo lectura', () => {
    expect(schema('CreateAttractionDto').required).toEqual(
      expect.arrayContaining([
        'name',
        'description',
        'type',
        'latitude',
        'longitude',
        'duration_hours',
        'city_id',
        'operator_id',
      ]),
    );
    expect(schema('CreateAttractionDto').properties?.latitude).toEqual(
      expect.objectContaining({ minimum: -90, maximum: 90 }),
    );
    expect(schema('CreateAttractionDto').properties?.duration_hours).toEqual(
      expect.objectContaining({ minimum: 0.01, maximum: 720 }),
    );
    expect(schema('CreateAttractionDto').properties).not.toHaveProperty(
      'average_rating',
    );
    expect(schema('AttractionResponseDto').properties?.average_rating).toEqual(
      expect.objectContaining({ readOnly: true }),
    );
    expect(schema('AttractionResponseDto').properties?.id).toEqual(
      expect.objectContaining({ type: 'string' }),
    );
    expect(schema('UpdateAttractionDto').required ?? []).toEqual([]);
    expect(document.paths['/api/v2/atracciones']?.get?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'limit',
          in: 'query',
          schema: expect.objectContaining({
            maximum: 50,
            default: 10,
          }),
        }),
        expect.objectContaining({ name: 'city', in: 'query' }),
      ]),
    );
    expect(
      document.paths['/api/v2/atracciones/search']?.post?.requestBody,
    ).toEqual(
      expect.objectContaining({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SearchAtraccionesRequestV2' },
          },
        },
      }),
    );
  });

  it('devuelve el error 400 documentado para búsquedas inválidas y no llama al servicio', async () => {
    const calls = mockAttractionsService.searchPublic?.mock.calls.length;
    const response = await request(app.getHttpServer())
      .post('/api/v2/atracciones/search')
      .set('X-Correlation-Id', 'cid-invalid-search')
      .send({ limit: 101, price: 5 })
      .expect(400);
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(response.body).toEqual(
      expect.objectContaining({
        status: 400,
        code: 'BAD_REQUEST',
        correlation_id: 'cid-invalid-search',
      }),
    );
    expect(mockAttractionsService.searchPublic?.mock.calls.length).toBe(calls);
  });

  it('devuelve el 404 documentado para una atracción no publicada o ausente', async () => {
    mockAttractionsService.findPublicById?.mockRejectedValueOnce(
      CatalogException.notFound(
        'Attraction unavailable',
        'ATTRACTION_NOT_FOUND',
      ),
    );
    const response = await request(app.getHttpServer())
      .get('/api/v2/atracciones/ausente')
      .expect(404);
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(response.body).toEqual(
      expect.objectContaining({ status: 404, code: 'ATTRACTION_NOT_FOUND' }),
    );
  });

  it('devuelve el 500 documentado sin exponer detalles internos', async () => {
    mockAttractionsService.searchPublic?.mockRejectedValueOnce(
      new Error('internal-sql-test-marker'),
    );
    const response = await request(app.getHttpServer())
      .post('/api/v2/atracciones/search')
      .set('X-Correlation-Id', 'cid-failure')
      .send({})
      .expect(500);
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(response.body).toEqual(
      expect.objectContaining({
        status: 500,
        code: 'INTERNAL_SERVER_ERROR',
        correlation_id: 'cid-failure',
      }),
    );
    expect(JSON.stringify(response.body)).not.toContain(
      'internal-sql-test-marker',
    );
  });
  it.each([
    ['/api/v2/atracciones', 'AtraccionCardResponseV2', 'data'],
    ['/api/v2/atracciones/1', 'AtraccionDetailResponseV2', 'detail'],
    ['/api/v2/atracciones/categorias', 'CategoryFlat', 'array'],
    ['/api/v2/atracciones/categorias/arbol', 'CategoryTreeNode', 'array'],
    ['/api/v2/idiomas', 'LanguageResponseDto', 'array'],
    ['/api/v2/inclusiones', 'InclusionResponseDto', 'array'],
  ])(
    '%s devuelve los campos obligatorios documentados',
    async (path, model, shape) => {
      const response = await request(app.getHttpServer())
        .get(path ?? '')
        .expect(200);
      const body = response.body as unknown;
      const value =
        shape === 'data'
          ? (body as { data: unknown[] }).data[0]
          : shape === 'array'
            ? (body as unknown[])[0]
            : body;
      expect(Object.keys(value as object)).toEqual(
        expect.arrayContaining(schema(model ?? '').required ?? []),
      );
    },
  );
});
