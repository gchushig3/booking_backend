import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/configure-application.js';

type PaymentRequest = {
  numero: string;
  orden_id: string;
  metodo_codigo: string;
  monto: string;
};

describe('Payment API with isolated PostgreSQL', () => {
  let app: INestApplication<App> | undefined;
  let dataSource: DataSource | undefined;
  const createdNumbers: string[] = [];
  let nextOrderId = 1000000000;

  function getApp(): INestApplication<App> {
    if (!app) {
      throw new Error('Integration application has not been initialized');
    }
    return app;
  }

  function getDataSource(): DataSource {
    if (!dataSource) {
      throw new Error('Integration database has not been initialized');
    }
    return dataSource;
  }

  function newPaymentNumber(): string {
    const numero = `IT-${randomUUID().replaceAll('-', '').slice(0, 20)}`;
    createdNumbers.push(numero);
    return numero;
  }

  function createRequest(
    numero = newPaymentNumber(),
    overrides: Partial<PaymentRequest> = {},
  ): PaymentRequest {
    return {
      numero,
      orden_id: '9223372036854775807',
      metodo_codigo: 'TARJETA',
      monto: '37.40',
      ...overrides,
    };
  }

  async function paymentCount(numero: string): Promise<number> {
    const [row] = (await getDataSource().query(
      'SELECT count(*)::int AS count FROM pago WHERE pag_numero = $1',
      [numero],
    )) as { count: number }[];
    return row.count;
  }

  async function createPayment(
    method: 'TARJETA' | 'TRANSFERENCIA' | 'EN_SITIO' | 'PAYPHAL',
    orderId = String(nextOrderId++),
  ) {
    const body = createRequest(newPaymentNumber(), {
      metodo_codigo: method,
      orden_id: orderId,
    });
    const response = await request(getApp().getHttpServer())
      .post('/api/v2/pagos')
      .send(body)
      .expect(201);
    return { body, payment: response.body };
  }

  async function waitForUniqueInsertLock(): Promise<boolean> {
    for (let attempt = 0; attempt < 160; attempt += 1) {
      const [row] = (await getDataSource().query(
        `SELECT count(*)::int AS count
         FROM pg_stat_activity
         WHERE datname = current_database()
           AND pid <> pg_backend_pid()
           AND wait_event_type = 'Lock'
           AND query ILIKE '%INSERT INTO "pago"%'`,
      )) as { count: number }[];
      if (row.count > 0) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return false;
  }

  async function raceAgainstUncommittedPayment(
    body: PaymentRequest,
    persistedBody: PaymentRequest = body,
  ) {
    const runner = getDataSource().createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    let responsePromise: Promise<request.Response> | undefined;

    try {
      await runner.query(
        `INSERT INTO pago (pag_numero, ord_id, mpa_id, est_id, pag_monto)
         SELECT $1, $2::bigint, metodo.mpa_id, estado.est_id, $3::dom_importe
         FROM metodo_pago AS metodo
         CROSS JOIN estado
         WHERE metodo.mpa_codigo = 'TARJETA'
           AND estado.est_codigo = 'PENDIENTE'`,
        [persistedBody.numero, persistedBody.orden_id, persistedBody.monto],
      );

      responsePromise = request(getApp().getHttpServer())
        .post('/api/v2/pagos')
        .send(body)
        .then((response) => response);

      const blockedByUniqueIndex = await waitForUniqueInsertLock();
      if (!blockedByUniqueIndex) {
        await runner.rollbackTransaction();
        await responsePromise;
        throw new Error(
          'HTTP payment insert did not wait on the PostgreSQL unique index',
        );
      }

      await runner.commitTransaction();
      return await responsePromise;
    } finally {
      if (runner.isTransactionActive) {
        await runner.rollbackTransaction();
      }
      await runner.release();
    }
  }

  beforeAll(async () => {
    const expectedEnvironment = {
      NODE_ENV: 'test',
      DB_HOST: '127.0.0.1',
      DB_PORT: '5434',
      DB_DATABASE: 'ms_payment_test',
    };
    for (const [name, expected] of Object.entries(expectedEnvironment)) {
      if (process.env[name] !== expected) {
        throw new Error(
          `${name} must target the isolated PostgreSQL test environment`,
        );
      }
    }
    if (!process.env.DB_USERNAME || !process.env.DB_PASSWORD) {
      throw new Error('Test database credentials are required');
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();
    dataSource = app.get(DataSource);

    expect(getDataSource().options).toMatchObject({
      type: 'postgres',
      host: '127.0.0.1',
      port: 5434,
      database: 'ms_payment_test',
      synchronize: false,
      dropSchema: false,
      migrationsRun: false,
    });

    const [database] = (await getDataSource().query(
      'SELECT current_database() AS name',
    )) as { name: string }[];
    expect(database.name).toBe('ms_payment_test');

    const catalogs = (await getDataSource().query(
      `SELECT
         (SELECT count(*)::int FROM metodo_pago) AS methods,
         (SELECT count(*)::int FROM estado) AS states`,
    )) as { methods: number; states: number }[];
    expect(catalogs[0]).toEqual({ methods: 4, states: 4 });

    const tables = (await getDataSource().query(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename = ANY($1::text[])`,
      [['metodo_pago', 'estado', 'pago', 'pago_tarjeta', 'pago_transferencia']],
    )) as { tablename: string }[];
    expect(tables.map(({ tablename }) => tablename).sort()).toEqual(
      [
        'metodo_pago',
        'estado',
        'pago',
        'pago_tarjeta',
        'pago_transferencia',
      ].sort(),
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized && createdNumbers.length > 0) {
      const removed = (await dataSource.query(
        'DELETE FROM pago WHERE pag_numero = ANY($1::varchar[]) RETURNING pag_id::text AS id',
        [createdNumbers],
      )) as { id: string }[];
      const [remaining] = (await dataSource.query(
        `SELECT
          (SELECT count(*)::int FROM pago WHERE pag_numero = ANY($1::varchar[])) AS pagos,
          (SELECT count(*)::int FROM pago_tarjeta WHERE pag_id = ANY($2::bigint[])) AS tarjetas,
          (SELECT count(*)::int FROM pago_transferencia WHERE pag_id = ANY($2::bigint[])) AS transferencias`,
        [createdNumbers, removed.map(({ id }) => id)],
      )) as { pagos: number; tarjetas: number; transferencias: number }[];
      expect(remaining).toEqual({ pagos: 0, tarjetas: 0, transferencias: 0 });
    }
    await app?.close();
  });

  it.each([
    '1',
    '42',
    '9007199254740993',
    '9199999999999999999',
    '9200000000000000000',
    '9220000000000000000',
    '9223372036854775807',
  ])(
    'preserves order BigId %s through HTTP and PostgreSQL',
    async (orderId) => {
      const { body, payment } = await createPayment('TRANSFERENCIA', orderId);
      expect(payment.orden_id).toBe(orderId);
      expect(typeof payment.orden_id).toBe('string');
      const fetched = await request(getApp().getHttpServer())
        .get(`/api/v2/pagos/${payment.id}`)
        .expect(200);
      expect(fetched.body.orden_id).toBe(orderId);
      expect(fetched.body.id).toBe(payment.id);
      const listed = await request(getApp().getHttpServer())
        .get('/api/v2/pagos')
        .query({ ord_id: orderId, limit: '100' })
        .expect(200);
      expect(
        listed.body.items.some(
          (item: { numero: string }) => item.numero === body.numero,
        ),
      ).toBe(true);
      expect(
        listed.body.items.every(
          (item: { orden_id: string }) => item.orden_id === orderId,
        ),
      ).toBe(true);
      const [stored] = (await getDataSource().query(
        'SELECT ord_id::text AS orden_id FROM pago WHERE pag_numero = $1',
        [body.numero],
      )) as { orden_id: string }[];
      expect(stored.orden_id).toBe(orderId);
    },
  );

  it.each([
    '9199999999999999999',
    '9200000000000000000',
    '9220000000000000000',
    '9223372036854775807',
  ])(
    'accepts 19-digit payment path %s and returns resource-not-found rather than invalid-ID',
    async (id) => {
      const response = await request(getApp().getHttpServer())
        .get(`/api/v2/pagos/${id}`)
        .expect(404);
      expect(response.body.code).toBe('NOT_FOUND');
    },
  );

  it.each([
    '0',
    '-1',
    '01',
    '+1',
    '1.0',
    '1e3',
    'abc',
    '9223372036854775808',
    '9999999999999999999',
    '10000000000000000000',
    ' 1',
    '1 ',
    '1\n',
  ])(
    'rejects invalid BigId %s on body, query and path with HTTP 400',
    async (value) => {
      const body = createRequest(newPaymentNumber(), { orden_id: value });
      const created = await request(getApp().getHttpServer())
        .post('/api/v2/pagos')
        .send(body)
        .expect(400);
      expect(created.body.code).toBe('INVALID_REQUEST');
      const listed = await request(getApp().getHttpServer())
        .get('/api/v2/pagos')
        .query({ ord_id: value })
        .expect(400);
      expect(listed.body.code).toBe('INVALID_REQUEST');
      const fetched = await request(getApp().getHttpServer())
        .get(`/api/v2/pagos/${encodeURIComponent(value)}`)
        .expect(400);
      expect(fetched.body.code).toBe('INVALID_ID');
      expect(await paymentCount(body.numero)).toBe(0);
    },
  );

  it.each([null, 1, 9007199254740992, '', true])(
    'rejects non-string or empty body BigId %s before writing',
    async (value) => {
      const body = { ...createRequest(), orden_id: value };
      const response = await request(getApp().getHttpServer())
        .post('/api/v2/pagos')
        .send(body)
        .expect(400);
      expect(response.body.code).toBe('INVALID_REQUEST');
      expect(await paymentCount(body.numero)).toBe(0);
    },
  );

  it.each(['TARJETA', 'TRANSFERENCIA'] as const)(
    'rechecks %s detail state after waiting for a concurrent finalization',
    async (method) => {
      const { payment } = await createPayment(method);
      const runner = getDataSource().createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      let responsePromise: Promise<request.Response> | undefined;
      try {
        await runner.query(
          `UPDATE pago SET est_id = (SELECT est_id FROM estado WHERE est_codigo = 'APROBADO'),
           pag_aprobado_en = CURRENT_TIMESTAMP WHERE pag_id = $1::bigint`,
          [payment.id],
        );
        const path = method === 'TARJETA' ? 'tarjeta' : 'transferencia';
        const body =
          method === 'TARJETA'
            ? {
                marca: 'VISA',
                ultimos4: '4242',
                titular: 'Prueba',
                mes: 5,
                anio: 2030,
                pais: 'EC',
              }
            : {
                banco: 'Prueba',
                numero_comprobante: 'AUDIT',
                fecha_transferencia: '2026-10-27',
              };
        responsePromise = request(getApp().getHttpServer())
          .post(`/api/v2/pagos/${payment.id}/${path}`)
          .send(body)
          .then((response) => response);
        let waiting = false;
        for (let attempt = 0; attempt < 160; attempt += 1) {
          const [row] = (await getDataSource().query(
            `SELECT EXISTS(SELECT 1 FROM pg_stat_activity
             WHERE datname = current_database() AND pid <> pg_backend_pid()
             AND wait_event_type = 'Lock' AND query ILIKE '%FOR UPDATE%') AS waiting`,
          )) as { waiting: boolean }[];
          if (row.waiting) {
            waiting = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        expect(waiting).toBe(true);
        await runner.commitTransaction();
        const response = await responsePromise;
        expect(response.status).toBe(422);
        expect(response.body.code).toBe('PAYMENT_NOT_PENDING');
        await request(getApp().getHttpServer())
          .get(`/api/v2/pagos/${payment.id}/${path}`)
          .expect(404);
      } finally {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
        await responsePromise;
        await runner.release();
      }
    },
  );

  it.each(['TARJETA', 'TRANSFERENCIA'] as const)(
    'returns 409 for an existing %s detail even after finalization',
    async (method) => {
      const { payment } = await createPayment(method);
      const path = `/api/v2/pagos/${payment.id}/${method === 'TARJETA' ? 'tarjeta' : 'transferencia'}`;
      const body =
        method === 'TARJETA'
          ? {
              marca: 'VISA',
              ultimos4: '4242',
              titular: 'Prueba',
              mes: 5,
              anio: 2030,
              pais: 'EC',
            }
          : {
              banco: 'Prueba',
              numero_comprobante: 'AUDIT-DUP',
              fecha_transferencia: '2026-10-27',
            };
      await request(getApp().getHttpServer()).post(path).send(body).expect(201);
      await request(getApp().getHttpServer())
        .post(`/api/v2/pagos/${payment.id}/simulaciones`)
        .send({ resultado: 'APROBADO' })
        .expect(200);
      const duplicate = await request(getApp().getHttpServer())
        .post(path)
        .send(body)
        .expect(409);
      expect(duplicate.body.code).toBe('DETAIL_ALREADY_EXISTS');
    },
  );

  it('creates a payment and reads it back with exact decimal and BIGINT serialization', async () => {
    const body = createRequest();
    const created = await request(getApp().getHttpServer())
      .post('/api/v2/pagos')
      .send(body)
      .expect(201);

    expect(created.headers.location).toBe(`/api/v2/pagos/${created.body.id}`);
    expect(created.body.numero).toBe(body.numero);
    expect(created.body.orden_id).toBe(body.orden_id);
    expect(created.body.id).toMatch(/^[0-9]+$/);
    expect(typeof created.body.id).toBe('string');
    expect(created.body.monto).toBe('37.40');
    expect(created.body.estado.codigo).toBe('PENDIENTE');
    expect(created.body.aprobado_en).toBeNull();
    expect(created.body.rechazado_en).toBeNull();
    expect(created.body.orden_validacion).toBe('NO_VALIDADA');

    const detail = await request(getApp().getHttpServer())
      .get(`/api/v2/pagos/${created.body.id}`)
      .expect(200);
    expect(detail.body).toEqual(created.body);

    const catalogMethods = await request(getApp().getHttpServer())
      .get('/api/v2/metodos-pago')
      .expect(200);
    const catalogStates = await request(getApp().getHttpServer())
      .get('/api/v2/estados-pago')
      .expect(200);
    expect(catalogMethods.body).toHaveLength(4);
    expect(catalogStates.body).toHaveLength(4);
  });

  it('returns 201, 200 for an equivalent retry, and 409 for conflicting data without duplicates', async () => {
    const body = createRequest();
    const first = await request(getApp().getHttpServer())
      .post('/api/v2/pagos')
      .send(body)
      .expect(201);
    const retry = await request(getApp().getHttpServer())
      .post('/api/v2/pagos')
      .send(body)
      .expect(200);
    const conflict = await request(getApp().getHttpServer())
      .post('/api/v2/pagos')
      .send({ ...body, monto: '37.41' })
      .expect(409);

    expect(retry.body.id).toBe(first.body.id);
    expect(conflict.body.code).toBe('PAYMENT_CONFLICT');
    expect(await paymentCount(body.numero)).toBe(1);
  });

  it('handles concurrent equivalent HTTP requests without duplicate rows or server errors', async () => {
    const body = createRequest();
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(getApp().getHttpServer()).post('/api/v2/pagos').send(body),
      ),
    );

    expect(
      responses.map(({ status }) => status).sort((left, right) => left - right),
    ).toEqual([200, 200, 200, 200, 200, 200, 200, 201]);
    expect(new Set(responses.map(({ body: result }) => result.id)).size).toBe(
      1,
    );
    expect(await paymentCount(body.numero)).toBe(1);
  });

  it('handles concurrent incompatible requests with one insert and 409 responses', async () => {
    const numero = newPaymentNumber();
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        request(getApp().getHttpServer())
          .post('/api/v2/pagos')
          .send(createRequest(numero, { monto: `${(index + 10).toFixed(2)}` })),
      ),
    );

    expect(responses.filter(({ status }) => status === 201)).toHaveLength(1);
    expect(responses.filter(({ status }) => status === 409)).toHaveLength(5);
    expect(responses.some(({ status }) => status === 500)).toBe(false);
    expect(await paymentCount(numero)).toBe(1);
  });

  it('resolves a real PostgreSQL unique-index race for equivalent data', async () => {
    const body = createRequest();
    const response = await raceAgainstUncommittedPayment(body);

    expect(response.status).toBe(200);
    expect(response.body.numero).toBe(body.numero);
    expect(response.body.monto).toBe(body.monto);
    expect(await paymentCount(body.numero)).toBe(1);
  });

  it('returns 409 for a real PostgreSQL unique-index race with incompatible data', async () => {
    const winningRequest = createRequest();
    const conflictingRequest = {
      ...winningRequest,
      monto: '38.40',
    };
    const response = await raceAgainstUncommittedPayment(
      conflictingRequest,
      winningRequest,
    );

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('PAYMENT_CONFLICT');
    expect(await paymentCount(winningRequest.numero)).toBe(1);
  });

  it('creates, reads, validates, and persists non-sensitive card details', async () => {
    const { payment } = await createPayment('TARJETA');
    const path = `/api/v2/pagos/${payment.id}/tarjeta`;
    const body = {
      marca: 'VISA',
      ultimos4: '4242',
      titular: 'Cliente de prueba',
      mes: 5,
      anio: 2030,
      pais: 'EC',
    };

    await request(getApp().getHttpServer()).get(path).expect(404);
    await request(getApp().getHttpServer())
      .post(`/api/v2/pagos/${payment.id}/transferencia`)
      .send({
        banco: 'Banco de prueba',
        numero_comprobante: 'COMPROBANTE-TARJETA',
        fecha_transferencia: '2026-10-27',
      })
      .expect(422);

    const created = await request(getApp().getHttpServer())
      .post(path)
      .send(body)
      .expect(201);
    expect(created.body).toMatchObject({
      pago_id: payment.id,
      marca: 'VISA',
      ultimos4: '4242',
      titular: 'Cliente de prueba',
      mes: 5,
      anio: 2030,
      pais: 'EC',
    });
    expect(typeof created.body.id).toBe('string');
    expect(Object.keys(created.body).sort()).toEqual(
      [
        'id',
        'pago_id',
        'marca',
        'ultimos4',
        'titular',
        'mes',
        'anio',
        'pais',
      ].sort(),
    );

    const fetched = await request(getApp().getHttpServer())
      .get(path)
      .expect(200);
    expect(fetched.body).toEqual(created.body);

    await request(getApp().getHttpServer()).post(path).send(body).expect(409);

    const rows = (await getDataSource().query(
      `SELECT pat_id::text AS id, pag_id::text AS pago_id, pat_marca, pat_ultimos4,
              pat_titular, pat_mes, pat_anio, pat_pais
       FROM pago_tarjeta WHERE pag_id = $1::bigint`,
      [payment.id],
    )) as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: created.body.id,
      pago_id: payment.id,
      pat_marca: 'VISA',
      pat_ultimos4: '4242',
      pat_titular: 'Cliente de prueba',
    });

    const sensitiveColumns = (await getDataSource().query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name IN ('pago_tarjeta', 'pago_transferencia')
         AND column_name ~* '(pan|cvv|cvc|pin|password|token|cuenta|account)'`,
    )) as { column_name: string }[];
    expect(sensitiveColumns).toHaveLength(0);

    const paymentState = (await getDataSource().query(
      `SELECT estado.est_codigo AS estado
       FROM pago
       JOIN estado USING (est_id)
       WHERE pago.pag_id = $1::bigint`,
      [payment.id],
    )) as { estado: string }[];
    expect(paymentState[0].estado).toBe('PENDIENTE');
  });

  it('creates, reads, validates, and persists transfer details without changing payment state', async () => {
    const { payment } = await createPayment('TRANSFERENCIA');
    const path = `/api/v2/pagos/${payment.id}/transferencia`;
    const body = {
      banco: 'Banco de prueba',
      numero_comprobante: 'COMPROBANTE-TRANSFERENCIA-1',
      fecha_transferencia: '2026-10-27',
      archivo_adjunto: 'referencias/comprobante-prueba.pdf',
    };

    await request(getApp().getHttpServer())
      .post(`/api/v2/pagos/${payment.id}/tarjeta`)
      .send({
        marca: 'VISA',
        ultimos4: '4242',
        titular: 'Cliente de prueba',
        mes: 5,
        anio: 2030,
        pais: 'EC',
      })
      .expect(422);

    const created = await request(getApp().getHttpServer())
      .post(path)
      .send(body)
      .expect(201);
    expect(created.body).toMatchObject({
      pago_id: payment.id,
      banco: body.banco,
      numero_comprobante: body.numero_comprobante,
      fecha_transferencia: body.fecha_transferencia,
      archivo_adjunto: body.archivo_adjunto,
    });
    expect(typeof created.body.id).toBe('string');
    expect(Object.keys(created.body).sort()).toEqual(
      [
        'id',
        'pago_id',
        'banco',
        'numero_comprobante',
        'fecha_transferencia',
        'archivo_adjunto',
      ].sort(),
    );

    const fetched = await request(getApp().getHttpServer())
      .get(path)
      .expect(200);
    expect(fetched.body).toEqual(created.body);
    await request(getApp().getHttpServer()).post(path).send(body).expect(409);

    const rows = (await getDataSource().query(
      `SELECT ptr_id::text AS id, pag_id::text AS pago_id, ptr_banco,
              ptr_numero_comprobante, ptr_fecha_transferencia::text AS fecha_transferencia,
              ptr_archivo_adjunto
       FROM pago_transferencia WHERE pag_id = $1::bigint`,
      [payment.id],
    )) as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: created.body.id,
      pago_id: payment.id,
      ptr_banco: body.banco,
      ptr_numero_comprobante: body.numero_comprobante,
      fecha_transferencia: body.fecha_transferencia,
      ptr_archivo_adjunto: body.archivo_adjunto,
    });

    const paymentState = (await getDataSource().query(
      `SELECT estado.est_codigo AS estado
       FROM pago
       JOIN estado USING (est_id)
       WHERE pago.pag_id = $1::bigint`,
      [payment.id],
    )) as { estado: string }[];
    expect(paymentState[0].estado).toBe('PENDIENTE');
  });

  it('serializes concurrent card-detail attempts as one creation and conflicts', async () => {
    const { payment } = await createPayment('TARJETA');
    const body = {
      marca: 'VISA',
      ultimos4: '4242',
      titular: 'Cliente de prueba',
      mes: 5,
      anio: 2030,
      pais: 'EC',
    };

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(getApp().getHttpServer())
          .post(`/api/v2/pagos/${payment.id}/tarjeta`)
          .send(body),
      ),
    );

    expect(responses.filter(({ status }) => status === 201)).toHaveLength(1);
    expect(responses.filter(({ status }) => status === 409)).toHaveLength(4);
    expect(responses.some(({ status }) => status === 500)).toBe(false);
    const [row] = (await getDataSource().query(
      'SELECT count(*)::int AS count FROM pago_tarjeta WHERE pag_id = $1::bigint',
      [payment.id],
    )) as { count: number }[];
    expect(row.count).toBe(1);
  });

  it('serializes concurrent transfer-detail attempts as one creation and conflicts', async () => {
    const { payment } = await createPayment('TRANSFERENCIA');
    const body = {
      banco: 'Banco de prueba',
      numero_comprobante: 'COMPROBANTE-CONCURRENTE',
      fecha_transferencia: '2026-10-27',
    };

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(getApp().getHttpServer())
          .post(`/api/v2/pagos/${payment.id}/transferencia`)
          .send(body),
      ),
    );

    expect(responses.filter(({ status }) => status === 201)).toHaveLength(1);
    expect(responses.filter(({ status }) => status === 409)).toHaveLength(4);
    expect(responses.some(({ status }) => status === 500)).toBe(false);
    const [row] = (await getDataSource().query(
      'SELECT count(*)::int AS count FROM pago_transferencia WHERE pag_id = $1::bigint',
      [payment.id],
    )) as { count: number }[];
    expect(row.count).toBe(1);
  });

  it('returns 404 for missing payments and details, and 400 for invalid detail IDs or bodies', async () => {
    await request(getApp().getHttpServer())
      .get('/api/v2/pagos/9223372036854775807/tarjeta')
      .expect(404);
    await request(getApp().getHttpServer())
      .get('/api/v2/pagos/9223372036854775807/transferencia')
      .expect(404);
    await request(getApp().getHttpServer())
      .get('/api/v2/pagos/not-an-id/tarjeta')
      .expect(400);

    const { payment } = await createPayment('TARJETA');
    await request(getApp().getHttpServer())
      .post(`/api/v2/pagos/${payment.id}/tarjeta`)
      .send({ marca: 'VISA', ultimos4: '123' })
      .expect(400);
    await request(getApp().getHttpServer())
      .post(`/api/v2/pagos/${payment.id}/transferencia`)
      .send({
        banco: 'Banco de prueba',
        numero_comprobante: 'COMPROBANTE-INVALIDO',
        fecha_transferencia: '2026-02-30',
      })
      .expect(400);
  });

  it('simulates approval after card details and rejects repeated simulation', async () => {
    const { payment } = await createPayment('TARJETA');
    const path = `/api/v2/pagos/${payment.id}/simulaciones`;
    const requestBody = { resultado: 'APROBADO' };

    await request(getApp().getHttpServer())
      .post(path)
      .send(requestBody)
      .expect(422)
      .expect(({ body }) => expect(body.code).toBe('CARD_DETAIL_REQUIRED'));

    await request(getApp().getHttpServer())
      .post(`/api/v2/pagos/${payment.id}/tarjeta`)
      .send({
        marca: 'VISA',
        ultimos4: '4242',
        titular: 'Cliente de prueba',
        mes: 5,
        anio: 2030,
        pais: 'EC',
      })
      .expect(201);

    const approved = await request(getApp().getHttpServer())
      .post(path)
      .send(requestBody)
      .expect(200);
    expect(approved.body.estado.codigo).toBe('APROBADO');
    expect(approved.body.aprobado_en).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(approved.body.rechazado_en).toBeNull();
    expect(approved.body.motivo_rechazo).toBeNull();

    const repeated = await request(getApp().getHttpServer())
      .post(path)
      .send(requestBody)
      .expect(409);
    expect(repeated.body.code).toBe('PAYMENT_ALREADY_FINAL');

    const rows = (await getDataSource().query(
      `SELECT estado.est_codigo AS estado, pag_aprobado_en, pag_rechazado_en,
              pag_motivo_rechazo
       FROM pago JOIN estado USING (est_id) WHERE pag_id = $1::bigint`,
      [payment.id],
    )) as {
      estado: string;
      pag_aprobado_en: Date | null;
      pag_rechazado_en: Date | null;
      pag_motivo_rechazo: string | null;
    }[];
    expect(rows[0]).toMatchObject({
      estado: 'APROBADO',
      pag_rechazado_en: null,
      pag_motivo_rechazo: null,
    });
    expect(rows[0].pag_aprobado_en).toBeInstanceOf(Date);
  });

  it.each([
    ['RECHAZADO', 'Fondos insuficientes'],
    ['FALLIDO', 'Fallo simulado'],
  ] as const)(
    'persists %s with its required reason and SQL-compatible timestamps',
    async (resultado, motivo) => {
      const { payment } = await createPayment('TRANSFERENCIA');
      const response = await request(getApp().getHttpServer())
        .post(`/api/v2/pagos/${payment.id}/simulaciones`)
        .send({ resultado, motivo })
        .expect(200);

      expect(response.body.estado.codigo).toBe(resultado);
      expect(response.body.aprobado_en).toBeNull();
      expect(response.body.rechazado_en).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(response.body.motivo_rechazo).toBe(motivo);

      const rows = (await getDataSource().query(
        `SELECT estado.est_codigo AS estado, pag_aprobado_en, pag_rechazado_en,
                pag_motivo_rechazo
         FROM pago JOIN estado USING (est_id) WHERE pag_id = $1::bigint`,
        [payment.id],
      )) as {
        estado: string;
        pag_aprobado_en: Date | null;
        pag_rechazado_en: Date | null;
        pag_motivo_rechazo: string | null;
      }[];
      expect(rows[0]).toMatchObject({
        estado: resultado,
        pag_aprobado_en: null,
        pag_motivo_rechazo: motivo,
      });
      expect(rows[0].pag_rechazado_en).toBeInstanceOf(Date);
    },
  );

  it('allows transfer simulation without a transfer detail', async () => {
    const { payment } = await createPayment('TRANSFERENCIA');
    const response = await request(getApp().getHttpServer())
      .post(`/api/v2/pagos/${payment.id}/simulaciones`)
      .send({ resultado: 'APROBADO' })
      .expect(200);
    expect(response.body.estado.codigo).toBe('APROBADO');
    const [details] = (await getDataSource().query(
      'SELECT count(*)::int AS count FROM pago_transferencia WHERE pag_id = $1::bigint',
      [payment.id],
    )) as { count: number }[];
    expect(details.count).toBe(0);
  });

  it.each(['EN_SITIO', 'PAYPHAL'] as const)(
    'simulates %s without requiring undocumented payment details',
    async (method) => {
      const { payment } = await createPayment(method);
      const response = await request(getApp().getHttpServer())
        .post(`/api/v2/pagos/${payment.id}/simulaciones`)
        .send({ resultado: 'APROBADO' })
        .expect(200);
      expect(response.body.estado.codigo).toBe('APROBADO');
      expect(response.body.metodo.codigo).toBe(method);
    },
  );

  it('serializes concurrent equivalent simulations into one success and conflicts', async () => {
    const { payment } = await createPayment('TRANSFERENCIA');
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(getApp().getHttpServer())
          .post(`/api/v2/pagos/${payment.id}/simulaciones`)
          .send({ resultado: 'APROBADO' }),
      ),
    );

    expect(responses.filter(({ status }) => status === 200)).toHaveLength(1);
    expect(responses.filter(({ status }) => status === 409)).toHaveLength(7);
    expect(responses.some(({ status }) => status === 500)).toBe(false);
    const [count] = (await getDataSource().query(
      `SELECT count(*)::int AS count
       FROM pago JOIN estado USING (est_id)
       WHERE ord_id = $1::bigint AND est_codigo = 'APROBADO'`,
      [payment.orden_id],
    )) as { count: number }[];
    expect(count.count).toBe(1);
  });

  it('allows only one concurrent final outcome for incompatible simulations', async () => {
    const { payment } = await createPayment('TRANSFERENCIA');
    const responses = await Promise.all([
      request(getApp().getHttpServer())
        .post(`/api/v2/pagos/${payment.id}/simulaciones`)
        .send({ resultado: 'RECHAZADO', motivo: 'Rechazo concurrente' }),
      request(getApp().getHttpServer())
        .post(`/api/v2/pagos/${payment.id}/simulaciones`)
        .send({ resultado: 'FALLIDO', motivo: 'Fallo concurrente' }),
    ]);

    expect(responses.filter(({ status }) => status === 200)).toHaveLength(1);
    expect(responses.filter(({ status }) => status === 409)).toHaveLength(1);
    expect(responses.some(({ status }) => status === 500)).toBe(false);
    const [row] = (await getDataSource().query(
      `SELECT estado.est_codigo AS estado, pag_motivo_rechazo, pag_rechazado_en
       FROM pago JOIN estado USING (est_id) WHERE pag_id = $1::bigint`,
      [payment.id],
    )) as {
      estado: string;
      pag_motivo_rechazo: string;
      pag_rechazado_en: Date;
    }[];
    expect(['RECHAZADO', 'FALLIDO']).toContain(row.estado);
    expect(row.pag_motivo_rechazo).toBeTruthy();
    expect(row.pag_rechazado_en).toBeInstanceOf(Date);
  });

  it('enforces the partial unique approved-order index for concurrent payments', async () => {
    const orderId = String(nextOrderId++);
    const { payment: first } = await createPayment('TARJETA', orderId);
    const { payment: second } = await createPayment('TARJETA', orderId);
    const cardDetails = {
      marca: 'VISA',
      ultimos4: '4242',
      titular: 'Cliente de prueba',
      mes: 5,
      anio: 2030,
      pais: 'EC',
    };
    await request(getApp().getHttpServer())
      .post(`/api/v2/pagos/${first.id}/tarjeta`)
      .send(cardDetails)
      .expect(201);
    await request(getApp().getHttpServer())
      .post(`/api/v2/pagos/${second.id}/tarjeta`)
      .send(cardDetails)
      .expect(201);

    const responses = await Promise.all(
      [first, second].map((payment) =>
        request(getApp().getHttpServer())
          .post(`/api/v2/pagos/${payment.id}/simulaciones`)
          .send({ resultado: 'APROBADO' }),
      ),
    );

    expect(responses.filter(({ status }) => status === 200)).toHaveLength(1);
    expect(responses.filter(({ status }) => status === 409)).toHaveLength(1);
    expect(responses.some(({ status }) => status === 500)).toBe(false);
    const [approved] = (await getDataSource().query(
      `SELECT count(*)::int AS count
       FROM pago
       WHERE ord_id = $1::bigint AND pag_aprobado_en IS NOT NULL`,
      [orderId],
    )) as { count: number }[];
    expect(approved.count).toBe(1);
    const conflict = responses.find(({ status }) => status === 409);
    expect(conflict?.body.code).toBe('ORDER_ALREADY_HAS_APPROVED_PAYMENT');
  });

  it('validates simulation bodies and refuses simulations while disabled', async () => {
    const { payment } = await createPayment('TRANSFERENCIA');
    const path = `/api/v2/pagos/${payment.id}/simulaciones`;

    await request(getApp().getHttpServer())
      .post(path)
      .send({ resultado: 'PENDIENTE' })
      .expect(400);
    await request(getApp().getHttpServer())
      .post(path)
      .send({ resultado: 'RECHAZADO' })
      .expect(400);
    await request(getApp().getHttpServer())
      .post(path)
      .send({ resultado: 'FALLIDO', motivo: '   ' })
      .expect(400);
    await request(getApp().getHttpServer())
      .post(path)
      .send({ resultado: 'APROBADO', pag_aprobado_en: '2026-10-27T18:00:00Z' })
      .expect(400);
    await request(getApp().getHttpServer())
      .post('/api/v2/pagos/9223372036854775807/simulaciones')
      .send({ resultado: 'APROBADO' })
      .expect(404);
    await request(getApp().getHttpServer())
      .post('/api/v2/pagos/not-an-id/simulaciones')
      .send({ resultado: 'APROBADO' })
      .expect(400);
  });
});
