import {
  ConflictException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  DeepPartial,
  DataSource,
  EntityManager,
  FindOneOptions,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { Estado } from '../estado/estado.entity.js';
import { MetodoPago } from '../metodo_pago/metodo_pago.entity.js';
import { PagoTarjeta } from '../pago_tarjeta/pago_tarjeta.entity.js';
import { CrearPagoRequestDto } from './dto/crear-pago-request.dto.js';
import { ListarPagosQueryDto } from './dto/listar-pagos-query.dto.js';
import { SimularPagoRequestDto } from './dto/simular-pago-request.dto.js';
import { Pago } from './pago.entity.js';
import { PagoService } from './pago.service.js';

describe('PagoService', () => {
  let service: PagoService;

  const pagoRepository = {
    findOne: vi.fn<(options: FindOneOptions<Pago>) => Promise<Pago | null>>(),
    create: vi.fn<(entityLike: DeepPartial<Pago>) => Pago>(),
    save: vi.fn<(entity: Pago) => Promise<Pago>>(),
    createQueryBuilder: vi.fn(),
  };
  const metodoPagoRepository = {
    findOneBy: vi.fn<Repository<MetodoPago>['findOneBy']>(),
  };
  const estadoRepository = {
    findOneBy: vi.fn<Repository<Estado>['findOneBy']>(),
  };
  const configService = {
    getOrThrow: vi.fn().mockReturnValue('development'),
    get: vi.fn().mockReturnValue('true'),
  };
  const simulationPaymentRepository = {
    findOne: vi.fn<Repository<Pago>['findOne']>(),
  };
  const simulationStateRepository = {
    findOneBy: vi.fn<Repository<Estado>['findOneBy']>(),
  };
  const simulationMethodRepository = {
    findOneBy: vi.fn<Repository<MetodoPago>['findOneBy']>(),
  };
  const simulationCardRepository = {
    findOneBy: vi.fn<Repository<PagoTarjeta>['findOneBy']>(),
  };
  const simulationUpdateBuilder = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn(),
  };
  const simulationManager = {
    getRepository: vi.fn(
      (
        entity:
          typeof Pago | typeof Estado | typeof MetodoPago | typeof PagoTarjeta,
      ) => {
        if (entity === Pago) return simulationPaymentRepository;
        if (entity === Estado) return simulationStateRepository;
        if (entity === MetodoPago) return simulationMethodRepository;
        return simulationCardRepository;
      },
    ),
    createQueryBuilder: vi.fn(() => simulationUpdateBuilder),
  };
  const dataSource = {
    transaction: vi.fn(
      async <T>(callback: (manager: EntityManager) => Promise<T>): Promise<T> =>
        callback(simulationManager as unknown as EntityManager),
    ),
  };
  const queryBuilder = {
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn(),
  };

  const method = Object.assign(new MetodoPago(), {
    mpaId: 1,
    mpaCodigo: 'TARJETA',
    mpaNombre: 'Tarjeta de credito/debito',
    mpaRequiereDatos: true,
    mpaActivo: true,
  });
  const pending = Object.assign(new Estado(), {
    estId: 1,
    estCodigo: 'PENDIENTE',
    estNombre: 'Pago pendiente',
    estFinal: false,
  });

  function makePayment(overrides: Partial<Pago> = {}): Pago {
    return Object.assign(new Pago(), {
      pagId: '9007199254740993',
      pagNumero: 'PAY-DEMO-000001',
      ordId: '9223372036854775807',
      mpaId: method.mpaId,
      estId: pending.estId,
      metodoPago: method,
      estado: pending,
      pagMonto: '125.50',
      pagReferencia: null,
      pagAutorizacion: null,
      pagFecha: new Date('2026-10-27T12:00:00.000Z'),
      pagAprobadoEn: null,
      pagRechazadoEn: null,
      pagMotivoRechazo: null,
      pagCreadoEn: new Date('2026-10-27T12:00:00.000Z'),
      ...overrides,
    });
  }

  beforeEach(async () => {
    vi.resetAllMocks();
    configService.getOrThrow.mockReturnValue('development');
    pagoRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    queryBuilder.leftJoinAndSelect.mockReturnThis();
    queryBuilder.andWhere.mockReturnThis();
    queryBuilder.orderBy.mockReturnThis();
    queryBuilder.addOrderBy.mockReturnThis();
    queryBuilder.skip.mockReturnThis();
    queryBuilder.take.mockReturnThis();
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
    configService.get.mockReturnValue('true');
    simulationPaymentRepository.findOne.mockReset();
    simulationStateRepository.findOneBy.mockReset();
    simulationMethodRepository.findOneBy.mockReset();
    simulationCardRepository.findOneBy.mockReset();
    simulationUpdateBuilder.execute.mockReset();
    simulationUpdateBuilder.update.mockReturnThis();
    simulationUpdateBuilder.set.mockReturnThis();
    simulationUpdateBuilder.where.mockReturnThis();
    simulationManager.getRepository.mockClear();
    simulationManager.createQueryBuilder.mockClear();
    dataSource.transaction.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagoService,
        { provide: getRepositoryToken(Pago), useValue: pagoRepository },
        {
          provide: getRepositoryToken(MetodoPago),
          useValue: metodoPagoRepository,
        },
        { provide: getRepositoryToken(Estado), useValue: estadoRepository },
        { provide: ConfigService, useValue: configService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(PagoService);
  });

  it('creates a pending payment and preserves BIGINT and NUMERIC values as strings', async () => {
    const saved = makePayment();
    const request = {
      numero: saved.pagNumero,
      orden_id: saved.ordId,
      metodo_codigo: method.mpaCodigo,
      monto: saved.pagMonto,
    } satisfies CrearPagoRequestDto;
    pagoRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(saved);
    metodoPagoRepository.findOneBy.mockResolvedValue(method);
    estadoRepository.findOneBy.mockResolvedValue(pending);
    pagoRepository.create.mockImplementation((values) =>
      Object.assign(new Pago(), values),
    );
    pagoRepository.save.mockResolvedValue(saved);

    const result = await service.crear(request);

    expect(result.status).toBe(HttpStatus.CREATED);
    expect(result.pago.id).toBe('9007199254740993');
    expect(result.pago.orden_id).toBe('9223372036854775807');
    expect(result.pago.monto).toBe('125.50');
    expect(result.pago.estado.codigo).toBe('PENDIENTE');
    expect(result.pago.aprobado_en).toBeNull();
    expect(result.pago.rechazado_en).toBeNull();
    expect(result.pago.motivo_rechazo).toBeNull();
    expect(result.pago.orden_validacion).toBe('NO_VALIDADA');
    expect(pagoRepository.save).toHaveBeenCalledOnce();
    expect(estadoRepository.findOneBy).toHaveBeenCalledWith({
      estCodigo: 'PENDIENTE',
    });
  });

  it('blocks test-mode writes unless the isolated test database is selected', async () => {
    configService.getOrThrow
      .mockReturnValueOnce('test')
      .mockReturnValueOnce('ms_payment');

    await expect(
      service.crear({
        numero: 'PAY-TEST-GUARD',
        orden_id: '42',
        metodo_codigo: 'TARJETA',
        monto: '1.00',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(pagoRepository.findOne).not.toHaveBeenCalled();
    expect(pagoRepository.save).not.toHaveBeenCalled();
  });

  it('returns the existing payment with 200 for an equivalent retry without saving', async () => {
    const existing = makePayment();
    pagoRepository.findOne.mockResolvedValue(existing);

    const result = await service.crear({
      numero: existing.pagNumero,
      orden_id: existing.ordId,
      metodo_codigo: method.mpaCodigo,
      monto: existing.pagMonto,
    });

    expect(result.status).toBe(HttpStatus.OK);
    expect(result.pago.id).toBe(existing.pagId);
    expect(pagoRepository.save).not.toHaveBeenCalled();
    expect(metodoPagoRepository.findOneBy).not.toHaveBeenCalled();
  });

  it('returns 409 when pag_numero is reused with incompatible fields', async () => {
    const existing = makePayment();
    pagoRepository.findOne.mockResolvedValue(existing);

    await expect(
      service.crear({
        numero: existing.pagNumero,
        orden_id: '42',
        metodo_codigo: method.mpaCodigo,
        monto: existing.pagMonto,
      }),
    ).rejects.toThrow(ConflictException);
    expect(pagoRepository.save).not.toHaveBeenCalled();
  });

  it('returns 422 when the method is missing or inactive', async () => {
    pagoRepository.findOne.mockResolvedValue(null);
    metodoPagoRepository.findOneBy.mockResolvedValue(null);

    await expect(
      service.crear({
        numero: 'PAY-DEMO-000002',
        orden_id: '42',
        metodo_codigo: 'PAYPAL',
        monto: '1.00',
      }),
    ).rejects.toThrow(UnprocessableEntityException);

    metodoPagoRepository.findOneBy.mockResolvedValue(
      Object.assign(new MetodoPago(), {
        mpaId: method.mpaId,
        mpaCodigo: method.mpaCodigo,
        mpaNombre: method.mpaNombre,
        mpaRequiereDatos: method.mpaRequiereDatos,
        mpaActivo: false,
      }),
    );
    await expect(
      service.crear({
        numero: 'PAY-DEMO-000003',
        orden_id: '42',
        metodo_codigo: 'TARJETA',
        monto: '1.00',
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('resolves a pag_numero race from the unique constraint and returns an equivalent payment', async () => {
    const raced = makePayment();
    pagoRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(raced);
    metodoPagoRepository.findOneBy.mockResolvedValue(method);
    estadoRepository.findOneBy.mockResolvedValue(pending);
    pagoRepository.create.mockImplementation((values) =>
      Object.assign(new Pago(), values),
    );
    pagoRepository.save.mockRejectedValue(
      new QueryFailedError(
        'INSERT INTO pago',
        [],
        Object.assign(new Error(), { code: '23505' }),
      ),
    );

    const result = await service.crear({
      numero: raced.pagNumero,
      orden_id: raced.ordId,
      metodo_codigo: method.mpaCodigo,
      monto: raced.pagMonto,
    });

    expect(result.status).toBe(HttpStatus.OK);
    expect(result.pago.id).toBe(raced.pagId);
  });

  it.each([
    '9200000000000000000',
    '9220000000000000000',
    '9223372036854775807',
  ])(
    'maps a controlled 19-digit payment ID %s without touching identities or sequences',
    async (id) => {
      pagoRepository.findOne.mockResolvedValue(
        makePayment({ pagId: id, ordId: id }),
      );
      const result = await service.obtenerPorId(id);
      expect(result.id).toBe(id);
      expect(result.orden_id).toBe(id);
      expect(pagoRepository.findOne).toHaveBeenCalledWith({
        where: { pagId: id },
        relations: { metodoPago: true, estado: true },
      });
    },
  );

  it('returns 404 when a payment id is not found', async () => {
    pagoRepository.findOne.mockResolvedValue(null);

    await expect(service.obtenerPorId('42')).rejects.toThrow(NotFoundException);
  });

  it('maps payment list filters, ordering, and pagination to TypeORM', async () => {
    const query: ListarPagosQueryDto = {
      ord_id: '9007199254740993',
      estado: 'PENDIENTE',
      metodo: 'TARJETA',
      limit: 5,
      offset: 10,
    };
    const payment = makePayment();
    queryBuilder.getManyAndCount.mockResolvedValue([[payment], 21]);

    const result = await service.listar(query);

    expect(result.total).toBe(21);
    expect(result.limit).toBe(5);
    expect(result.offset).toBe(10);
    expect(result.items[0].id).toBe(payment.pagId);
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      1,
      'pago.ordId = :ordId',
      {
        ordId: query.ord_id,
      },
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      2,
      'estado.estCodigo = :estado',
      {
        estado: query.estado,
      },
    );
    expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
      3,
      'metodoPago.mpaCodigo = :metodo',
      {
        metodo: query.metodo,
      },
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('pago.pagFecha', 'DESC');
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('pago.pagId', 'DESC');
    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
    expect(queryBuilder.take).toHaveBeenCalledWith(5);
  });

  it.each([
    ['APROBADO', undefined, 'pagAprobadoEn', 'pagRechazadoEn'],
    ['RECHAZADO', 'Fondos insuficientes', 'pagRechazadoEn', 'pagAprobadoEn'],
    ['FALLIDO', 'Error simulado', 'pagRechazadoEn', 'pagAprobadoEn'],
  ] as const)(
    'atomically transitions a pending payment to %s',
    async (resultado, motivo, setDateField, nullDateField) => {
      const current = makePayment();
      const targetState = Object.assign(new Estado(), {
        estId: resultado === 'APROBADO' ? 2 : resultado === 'RECHAZADO' ? 3 : 4,
        estCodigo: resultado,
        estNombre: resultado,
        estFinal: true,
      });
      const updated = makePayment({
        estId: targetState.estId,
        estado: targetState,
        pagAprobadoEn:
          resultado === 'APROBADO'
            ? new Date('2026-10-27T12:30:00.000Z')
            : null,
        pagRechazadoEn:
          resultado === 'APROBADO'
            ? null
            : new Date('2026-10-27T12:30:00.000Z'),
        pagMotivoRechazo: motivo ?? null,
      });
      simulationPaymentRepository.findOne
        .mockResolvedValueOnce(current)
        .mockResolvedValueOnce(updated);
      simulationStateRepository.findOneBy
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce(targetState);
      simulationMethodRepository.findOneBy.mockResolvedValue(method);
      simulationCardRepository.findOneBy.mockResolvedValue(
        makePayment() as never,
      );
      simulationUpdateBuilder.execute.mockResolvedValue({ affected: 1 });
      const request: SimularPagoRequestDto = Object.assign(
        new SimularPagoRequestDto(),
        {
          resultado,
          ...(motivo === undefined ? {} : { motivo }),
        },
      );

      const response = await service.simular(current.pagId, request);

      expect(response.estado.codigo).toBe(resultado);
      expect(response.aprobado_en).toBe(
        resultado === 'APROBADO' ? '2026-10-27T12:30:00.000Z' : null,
      );
      expect(response.rechazado_en).toBe(
        resultado === 'APROBADO' ? null : '2026-10-27T12:30:00.000Z',
      );
      expect(response.motivo_rechazo).toBe(motivo ?? null);
      expect(dataSource.transaction).toHaveBeenCalledOnce();
      expect(simulationUpdateBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          estId: targetState.estId,
          [setDateField]: expect.any(Function),
          [nullDateField]: null,
        }),
      );
      expect(simulationUpdateBuilder.where).toHaveBeenCalledWith(
        '"pag_id" = :id AND "est_id" = :pendingId',
        { id: current.pagId, pendingId: pending.estId },
      );
    },
  );

  it('returns 404 for a missing payment and 409 for a payment already finalized', async () => {
    simulationPaymentRepository.findOne.mockResolvedValueOnce(null);
    await expect(
      service.simular('42', { resultado: 'APROBADO' }),
    ).rejects.toThrow(NotFoundException);

    simulationPaymentRepository.findOne.mockResolvedValueOnce(
      makePayment({
        estId: 2,
        estado: Object.assign(new Estado(), {
          estId: 2,
          estCodigo: 'APROBADO',
          estFinal: true,
        }),
      }),
    );
    simulationStateRepository.findOneBy.mockResolvedValueOnce(
      Object.assign(new Estado(), {
        estId: 2,
        estCodigo: 'APROBADO',
        estFinal: true,
      }),
    );
    await expect(
      service.simular('42', { resultado: 'APROBADO' }),
    ).rejects.toThrow(ConflictException);
    expect(simulationUpdateBuilder.execute).not.toHaveBeenCalled();
  });

  it('requires card detail for TARJETA and permits transfer without a detail', async () => {
    simulationPaymentRepository.findOne.mockResolvedValueOnce(makePayment());
    simulationStateRepository.findOneBy.mockResolvedValueOnce(pending);
    simulationMethodRepository.findOneBy.mockResolvedValue(method);
    simulationCardRepository.findOneBy.mockResolvedValue(null);

    await expect(
      service.simular('42', { resultado: 'APROBADO' }),
    ).rejects.toThrow(UnprocessableEntityException);

    const transferMethod = Object.assign(new MetodoPago(), {
      mpaId: method.mpaId,
      mpaNombre: method.mpaNombre,
      mpaRequiereDatos: method.mpaRequiereDatos,
      mpaActivo: method.mpaActivo,
      mpaCodigo: 'TRANSFERENCIA',
    });
    const updated = makePayment({
      estId: 2,
      metodoPago: transferMethod,
      estado: Object.assign(new Estado(), {
        estId: 2,
        estCodigo: 'APROBADO',
        estFinal: true,
      }),
      pagAprobadoEn: new Date('2026-10-27T12:30:00.000Z'),
    });
    simulationPaymentRepository.findOne
      .mockResolvedValueOnce(makePayment({ metodoPago: transferMethod }))
      .mockResolvedValueOnce(updated);
    simulationStateRepository.findOneBy
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(updated.estado);
    simulationMethodRepository.findOneBy.mockResolvedValue(transferMethod);
    simulationUpdateBuilder.execute.mockResolvedValue({ affected: 1 });

    await expect(
      service.simular('42', { resultado: 'APROBADO' }),
    ).resolves.toMatchObject({ estado: { codigo: 'APROBADO' } });
    expect(simulationCardRepository.findOneBy).toHaveBeenCalledOnce();
  });

  it('maps concurrent state change and approved-order unique violations to 409', async () => {
    const request: SimularPagoRequestDto = {
      resultado: 'RECHAZADO',
      motivo: 'Rechazado',
    };
    simulationPaymentRepository.findOne.mockResolvedValue(makePayment());
    simulationStateRepository.findOneBy
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(
        Object.assign(new Estado(), {
          estId: 3,
          estCodigo: 'RECHAZADO',
          estFinal: true,
        }),
      );
    simulationMethodRepository.findOneBy.mockResolvedValue(method);
    simulationCardRepository.findOneBy.mockResolvedValue(
      makePayment() as never,
    );
    simulationUpdateBuilder.execute.mockResolvedValue({ affected: 0 });

    await expect(service.simular('42', request)).rejects.toThrow(
      ConflictException,
    );

    simulationUpdateBuilder.execute.mockRejectedValue(
      new QueryFailedError(
        'UPDATE pago',
        [],
        Object.assign(new Error(), {
          code: '23505',
          constraint: 'ux_pago_orden_aprobado',
        }),
      ),
    );
    simulationPaymentRepository.findOne.mockResolvedValue(makePayment());
    simulationStateRepository.findOneBy
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(
        Object.assign(new Estado(), {
          estId: 2,
          estCodigo: 'APROBADO',
          estFinal: true,
        }),
      );
    simulationMethodRepository.findOneBy.mockResolvedValue(method);
    simulationCardRepository.findOneBy.mockResolvedValue(
      makePayment() as never,
    );
    const approvalRequest: SimularPagoRequestDto = { resultado: 'APROBADO' };
    await expect(service.simular('42', approvalRequest)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ORDER_ALREADY_HAS_APPROVED_PAYMENT',
      }),
      status: 409,
    });
  });

  it('disables simulation in production and protects test writes to development', async () => {
    configService.getOrThrow.mockReturnValueOnce('production');
    await expect(
      service.simular('42', { resultado: 'APROBADO' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SIMULATION_DISABLED' }),
      status: 403,
    });

    configService.getOrThrow
      .mockReturnValueOnce('test')
      .mockReturnValueOnce('127.0.0.1')
      .mockReturnValueOnce(5434)
      .mockReturnValueOnce('ms_payment');
    await expect(
      service.simular('42', { resultado: 'APROBADO' }),
    ).rejects.toThrow(ForbiddenException);
    expect(dataSource.transaction).not.toHaveBeenCalled();

    configService.getOrThrow
      .mockReturnValueOnce('test')
      .mockReturnValueOnce('127.0.0.1')
      .mockReturnValueOnce(5433);
    await expect(
      service.simular('42', { resultado: 'APROBADO' }),
    ).rejects.toThrow(ForbiddenException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
