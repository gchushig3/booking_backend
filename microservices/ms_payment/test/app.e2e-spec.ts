import { readFileSync } from 'node:fs';
import { parseDocument } from 'yaml';
import { RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { MetodoPagoController } from '../src/metodo_pago/metodo_pago.controller.js';
import { EstadoController } from '../src/estado/estado.controller.js';
import { PagoController } from '../src/pago/pago.controller.js';
import { PagoTarjetaController } from '../src/pago_tarjeta/pago_tarjeta.controller.js';
import { PagoTransferenciaController } from '../src/pago_transferencia/pago_transferencia.controller.js';
import { loadPaymentOpenApi } from '../src/configure-application.js';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApplication } from '../src/configure-application.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    if (
      process.env.DB_HOST !== '127.0.0.1' ||
      process.env.DB_PORT !== '5434' ||
      process.env.DB_DATABASE !== 'ms_payment_test' ||
      process.env.NODE_ENV !== 'test'
    ) {
      throw new Error(
        'E2E tests require the isolated PostgreSQL test database',
      );
    }
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();
    app.get(ConfigService).set('SIMULATION_ENABLED', 'false');
  });

  const expectedOperations = [
    ['get', '/metodos-pago'],
    ['get', '/metodos-pago/{id}'],
    ['get', '/estados-pago'],
    ['get', '/estados-pago/{id}'],
    ['post', '/pagos'],
    ['get', '/pagos'],
    ['get', '/pagos/{id}'],
    ['post', '/pagos/{id}/simulaciones'],
    ['post', '/pagos/{id}/tarjeta'],
    ['get', '/pagos/{id}/tarjeta'],
    ['post', '/pagos/{id}/transferencia'],
    ['get', '/pagos/{id}/transferencia'],
  ] as const;

  it('serves Swagger UI and its local initialization/assets at exactly /api/docs', async () => {
    const ui = await request(app.getHttpServer()).get('/api/docs').expect(200);
    expect(ui.headers['content-type']).toContain('text/html');
    expect(ui.text).toContain('swagger-ui-init.js');
    await request(app.getHttpServer())
      .get('/api/docs/swagger-ui-bundle.js')
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/docs/swagger-ui.css')
      .expect(200);
    const init = await request(app.getHttpServer())
      .get('/api/docs/swagger-ui-init.js')
      .expect(200);
    expect(init.text).toContain('2.0.0');
    expect(init.text).toContain('http://localhost:3000/api/v2');
    expect(init.text).toContain('crearPago');
    expect(init.text).not.toContain('http://localhost:3000/api/v1');
    await request(app.getHttpServer()).get('/api/v2/api/docs').expect(404);
    await request(app.getHttpServer()).get('/api/v1').expect(404);
  });

  it('publishes the complete canonical API-first v2 document, not a decorator-generated empty spec', async () => {
    const published = await request(app.getHttpServer())
      .get('/api/docs/openapi.json')
      .expect(200);
    expect(published.headers['content-type']).toContain('application/json');
    expect(published.body).toEqual(loadPaymentOpenApi());
    expect(published.body.openapi).toBe('3.0.3');
    expect(published.body.info.version).toBe('2.0.0');
    expect(published.body.servers).toEqual([
      {
        url: 'http://localhost:3000/api/v2',
        description: 'Desarrollo local (puerto configurable)',
      },
    ]);
    expect(published.body.info.description).toContain(
      'SIN autenticacion ni autorizacion HTTP',
    );
    expect(published.body.security).toEqual([{ BearerAuth: [] }]);
    expect(
      published.body.components.securitySchemes.BearerAuth.description,
    ).toContain('no implementado');
  });

  it('documents exactly the twelve unique methods/routes implemented by the real controllers', async () => {
    const document = loadPaymentOpenApi();
    const documented = Object.entries(document.paths).flatMap(([path, item]) =>
      ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']
        .filter((method) => method in item)
        .map((method) => `${method.toUpperCase()} ${path}`),
    );
    const implemented: string[] = [];
    for (const controller of [
      MetodoPagoController,
      EstadoController,
      PagoController,
      PagoTarjetaController,
      PagoTransferenciaController,
    ]) {
      const base: unknown = Reflect.getMetadata(PATH_METADATA, controller);
      if (typeof base !== 'string')
        throw new Error('Expected a relative controller path');
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        if (name === 'constructor') continue;
        const handler: unknown = Object.getOwnPropertyDescriptor(
          controller.prototype,
          name,
        )?.value;
        if (typeof handler !== 'function') continue;
        const method: unknown = Reflect.getMetadata(METHOD_METADATA, handler);
        const subpath: unknown = Reflect.getMetadata(PATH_METADATA, handler);
        if (typeof method !== 'number' || typeof subpath !== 'string') continue;
        const path = `/${base}/${subpath}`
          .replace(/\/+/g, '/')
          .replace(/\/$/, '')
          .replace(/:([^/]+)/g, '{$1}');
        implemented.push(`${RequestMethod[method]} ${path}`);
      }
    }
    const expected = expectedOperations
      .map(([method, path]) => `${method.toUpperCase()} ${path}`)
      .sort();
    expect(documented.sort()).toEqual(expected);
    expect(implemented.sort()).toEqual(expected);
    expect(new Set(documented).size).toBe(12);
    expect(new Set(implemented).size).toBe(12);
  });

  it('resolves every local ref and preserves schemas and business operations from historical v1', () => {
    const document = loadPaymentOpenApi();
    function checkRefs(value: unknown): void {
      if (typeof value !== 'object' || value === null) return;
      if ('$ref' in value) {
        expect(typeof value.$ref).toBe('string');
        const ref = String(value.$ref);
        expect(ref.startsWith('#/')).toBe(true);
        let target: unknown = document;
        for (const part of ref.slice(2).split('/')) {
          if (typeof target !== 'object' || target === null)
            throw new Error(`Unresolved ref ${ref}`);
          target = Reflect.get(
            target,
            part.replace(/~1/g, '/').replace(/~0/g, '~'),
          );
        }
        expect(target, ref).toBeDefined();
      }
      Object.values(value).forEach(checkRefs);
    }
    checkRefs(document);
    const historical: unknown = parseDocument(
      readFileSync('contract/ms_payment-openapi-v1.yaml', 'utf8'),
    ).toJS();
    if (
      typeof historical !== 'object' ||
      historical === null ||
      !('components' in historical) ||
      !('paths' in historical)
    )
      throw new Error('Missing historical v1');
    expect(document.components).toEqual(historical.components);
    expect(document.paths).toEqual(
      JSON.parse(
        JSON.stringify(historical.paths).replaceAll('/api/v1/', '/api/v2/'),
      ),
    );
  });

  it('publishes unchanged BigId, string amounts, catalog names and simulation rules', () => {
    const schemas = loadPaymentOpenApi().components?.schemas;
    const bigId = schemas?.BigId;
    const amount = schemas?.Importe;
    if (
      !bigId ||
      !('pattern' in bigId) ||
      !bigId.pattern ||
      !amount ||
      !('pattern' in amount) ||
      !amount.pattern
    )
      throw new Error('Missing numeric schemas');
    expect(bigId.type).toBe('string');
    expect(bigId.minLength).toBe(1);
    expect(bigId.maxLength).toBe(19);
    const pattern = new RegExp(bigId.pattern);
    for (const value of [
      '1',
      '9007199254740993',
      '9200000000000000000',
      '9223372036854775807',
    ])
      expect(pattern.test(value)).toBe(true);
    for (const value of ['0', '-1', '01', '9223372036854775808'])
      expect(pattern.test(value)).toBe(false);
    expect(amount.type).toBe('string');
    expect(new RegExp(amount.pattern).test('37.40')).toBe(true);
    expect(new RegExp(amount.pattern).test('0.00')).toBe(false);
    expect(schemas?.CodigoMetodo).toHaveProperty('enum', [
      'TARJETA',
      'TRANSFERENCIA',
      'EN_SITIO',
      'PAYPHAL',
    ]);
    expect(
      loadPaymentOpenApi().paths['/pagos/{id}/simulaciones'].post?.description,
    ).toContain('prohibida en produccion');
  });

  it('keeps ValidationPipe and the global exception filter active alongside Swagger', async () => {
    const invalid = await request(app.getHttpServer())
      .post('/api/v2/pagos')
      .send({
        numero: 'SWAGGER-INVALID',
        orden_id: 42,
        metodo_codigo: 'TARJETA',
        monto: 1.25,
        extra: 'forbidden',
      })
      .expect(400);
    expect(invalid.body.code).toBe('INVALID_REQUEST');
    const catalogError = await request(app.getHttpServer())
      .get('/api/v2/metodos-pago/0')
      .expect(400);
    expect(catalogError.body.code).toBe('INVALID_REQUEST');
  });

  it.each(expectedOperations)(
    'does not expose a v1 alias for %s %s',
    async (method, path) => {
      const oldPath = `/api/v1${path.replace('{id}', '42')}`;
      if (method === 'get')
        await request(app.getHttpServer()).get(oldPath).expect(404);
      else
        await request(app.getHttpServer()).post(oldPath).send({}).expect(404);
    },
  );

  it('serves the root health response under the API prefix', () => {
    return request(app.getHttpServer())
      .get('/api/v2')
      .expect(200)
      .expect('Hello World!');
  });

  it('lists payment methods in id order using the OpenAPI response shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v2/metodos-pago')
      .expect(200);

    expect(response.body).toHaveLength(4);
    expect(
      response.body.map((item: { codigo: string }) => item.codigo),
    ).toEqual(['TARJETA', 'TRANSFERENCIA', 'EN_SITIO', 'PAYPHAL']);
    const methodIds = response.body.map((item: { id: number }) => item.id);
    expect(methodIds).toEqual(
      methodIds.toSorted((a: number, b: number) => a - b),
    );
    expect(Object.keys(response.body[0]).sort()).toEqual(
      ['id', 'codigo', 'nombre', 'requiere_datos', 'activo'].sort(),
    );

    await request(app.getHttpServer())
      .get('/api/v2/metodos-pago?activo=true')
      .expect(200)
      .expect(({ body }) =>
        expect(body.every((item: { activo: boolean }) => item.activo)).toBe(
          true,
        ),
      );
  });

  it('gets an existing payment method and returns 404 for a missing one', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v2/metodos-pago')
      .expect(200);
    const methodId = list.body[0].id;

    const detail = await request(app.getHttpServer())
      .get(`/api/v2/metodos-pago/${methodId}`)
      .expect(200);
    expect(detail.body).toEqual(list.body[0]);

    await request(app.getHttpServer())
      .get('/api/v2/metodos-pago/32767')
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/v2/metodos-pago/0')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v2/metodos-pago/not-an-id')
      .expect(400);
  });

  it('lists payment states in id order with the database final flag', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v2/estados-pago')
      .expect(200);

    expect(response.body).toHaveLength(4);
    expect(
      response.body.map((item: { codigo: string }) => item.codigo),
    ).toEqual(['PENDIENTE', 'APROBADO', 'RECHAZADO', 'FALLIDO']);
    const stateIds = response.body.map((item: { id: number }) => item.id);
    expect(stateIds).toEqual(
      stateIds.toSorted((a: number, b: number) => a - b),
    );
    expect(
      response.body.map((item: { codigo: string; final: boolean }) => [
        item.codigo,
        item.final,
      ]),
    ).toEqual([
      ['PENDIENTE', false],
      ['APROBADO', true],
      ['RECHAZADO', true],
      ['FALLIDO', true],
    ]);
    expect(Object.keys(response.body[0]).sort()).toEqual(
      ['id', 'codigo', 'nombre', 'final'].sort(),
    );
  });

  it('gets an existing payment state and returns 404 for a missing one', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v2/estados-pago')
      .expect(200);
    const stateId = list.body[0].id;

    const detail = await request(app.getHttpServer())
      .get(`/api/v2/estados-pago/${stateId}`)
      .expect(200);
    expect(detail.body).toEqual(list.body[0]);

    await request(app.getHttpServer())
      .get('/api/v2/estados-pago/32767')
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/v2/estados-pago/-1')
      .expect(400);
  });

  it('lists payments with the OpenAPI page shape and supports documented filters', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v2/pagos?limit=1&offset=0')
      .expect(200);

    expect(Object.keys(response.body).sort()).toEqual(
      ['items', 'total', 'limit', 'offset'].sort(),
    );
    expect(response.body.items).toHaveLength(Math.min(response.body.total, 1));
    expect(response.body.limit).toBe(1);
    expect(response.body.offset).toBe(0);

    await request(app.getHttpServer())
      .get('/api/v2/pagos?estado=PENDIENTE&metodo=TARJETA')
      .expect(200);
  });

  it('gets a payment by BIGINT id when available and returns 404 for a missing one', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v2/pagos')
      .expect(200);
    if (response.body.items.length > 0) {
      const payment = response.body.items[0];
      const detail = await request(app.getHttpServer())
        .get(`/api/v2/pagos/${payment.id}`)
        .expect(200);
      expect(detail.body).toEqual(payment);
    }

    await request(app.getHttpServer())
      .get('/api/v2/pagos/9223372036854775807')
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/v2/pagos/9223372036854775808')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v2/pagos/not-an-id')
      .expect(400);
  });

  it('rejects an invalid payment request before any database write', async () => {
    await request(app.getHttpServer())
      .post('/api/v2/pagos')
      .send({
        numero: 'PAY-INVALID',
        orden_id: '42',
        metodo_codigo: 'TARJETA',
        monto: 1.25,
      })
      .expect(400);
  });

  it('blocks valid payment writes when configuration points to development', async () => {
    const config = app.get(ConfigService);
    config.set('DB_PORT', 5433);
    try {
      await request(app.getHttpServer())
        .post('/api/v2/pagos')
        .send({
          numero: `E2E-GUARD-${Date.now()}`,
          orden_id: '42',
          metodo_codigo: 'TARJETA',
          monto: '1.00',
        })
        .expect(403)
        .expect(({ body }) =>
          expect(body.code).toBe('ISOLATED_TEST_DATABASE_REQUIRED'),
        );
    } finally {
      config.set('DB_PORT', 5434);
    }
  });

  it('blocks detail writes when configuration points to development', async () => {
    const config = app.get(ConfigService);
    config.set('DB_PORT', 5433);
    try {
      await request(app.getHttpServer())
        .post('/api/v2/pagos/42/tarjeta')
        .send({
          marca: 'VISA',
          ultimos4: '4242',
          titular: 'Cliente de prueba',
          mes: 5,
          anio: 2030,
          pais: 'EC',
        })
        .expect(403)
        .expect(({ body }) =>
          expect(body.code).toBe('ISOLATED_TEST_DATABASE_REQUIRED'),
        );

      await request(app.getHttpServer())
        .post('/api/v2/pagos/42/transferencia')
        .send({
          banco: 'Banco de prueba',
          numero_comprobante: 'COMPROBANTE-TEST',
          fecha_transferencia: '2026-10-27',
        })
        .expect(403)
        .expect(({ body }) =>
          expect(body.code).toBe('ISOLATED_TEST_DATABASE_REQUIRED'),
        );
    } finally {
      config.set('DB_PORT', 5434);
    }
  });

  it('returns SIMULATION_DISABLED when simulations are not explicitly enabled', async () => {
    await request(app.getHttpServer())
      .post('/api/v2/pagos/42/simulaciones')
      .send({ resultado: 'APROBADO' })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('SIMULATION_DISABLED'));
  });

  afterAll(async () => {
    await app.close();
  });
});
