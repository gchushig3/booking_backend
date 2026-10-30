import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Estado } from '../estado/estado.entity.js';
import { MetodoPago } from '../metodo_pago/metodo_pago.entity.js';
import { Pago } from '../pago/pago.entity.js';
import { CrearDetalleTarjetaRequestDto } from './dto/crear-detalle-tarjeta-request.dto.js';
import { PagoTarjeta } from './pago_tarjeta.entity.js';
import { PagoTarjetaService } from './pago_tarjeta.service.js';

describe('PagoTarjetaService', () => {
  let service: PagoTarjetaService;

  const detailRepository = {
    findOneBy: vi.fn<Repository<PagoTarjeta>['findOneBy']>(),
    create: vi.fn<Repository<PagoTarjeta>['create']>(),
    save: vi.fn<Repository<PagoTarjeta>['save']>(),
  };
  const transaction = vi.fn();
  const paymentRepository = {
    manager: { transaction },
    findOne: vi.fn<Repository<Pago>['findOne']>(),
  };
  const configService = {
    getOrThrow: vi.fn().mockReturnValue('development'),
  };

  const request: CrearDetalleTarjetaRequestDto = {
    marca: 'VISA',
    ultimos4: '4242',
    titular: 'Cliente de prueba',
    mes: 5,
    anio: 2030,
    pais: 'EC',
  };

  function makePayment(overrides: Partial<Pago> = {}): Pago {
    return Object.assign(new Pago(), {
      pagId: '9007199254740993',
      metodoPago: Object.assign(new MetodoPago(), { mpaCodigo: 'TARJETA' }),
      estado: Object.assign(new Estado(), { estCodigo: 'PENDIENTE' }),
      ...overrides,
    });
  }

  function makeDetail(overrides: Partial<PagoTarjeta> = {}): PagoTarjeta {
    return Object.assign(new PagoTarjeta(), {
      patId: '9007199254740995',
      pagId: '9007199254740993',
      patMarca: 'VISA',
      patUltimos4: '4242',
      patTitular: 'Cliente de prueba',
      patMes: 5,
      patAnio: 2030,
      patPais: 'EC',
      ...overrides,
    });
  }

  beforeEach(async () => {
    vi.resetAllMocks();
    configService.getOrThrow.mockReturnValue('development');
    transaction.mockImplementation(async (callback) =>
      callback({
        getRepository: (target: unknown) =>
          target === Pago ? paymentRepository : detailRepository,
      }),
    );
    const module = await Test.createTestingModule({
      providers: [
        PagoTarjetaService,
        {
          provide: getRepositoryToken(PagoTarjeta),
          useValue: detailRepository,
        },
        { provide: getRepositoryToken(Pago), useValue: paymentRepository },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();
    service = module.get(PagoTarjetaService);
  });

  it('creates and serializes only the documented non-sensitive card fields', async () => {
    const saved = makeDetail();
    paymentRepository.findOne.mockResolvedValue(makePayment());
    detailRepository.findOneBy.mockResolvedValue(null);
    detailRepository.create.mockImplementation((values) =>
      Object.assign(new PagoTarjeta(), values),
    );
    detailRepository.save.mockResolvedValue(saved);

    await expect(service.crear('9007199254740993', request)).resolves.toEqual({
      id: '9007199254740995',
      pago_id: '9007199254740993',
      marca: 'VISA',
      ultimos4: '4242',
      titular: 'Cliente de prueba',
      mes: 5,
      anio: 2030,
      pais: 'EC',
    });
    expect(detailRepository.create).toHaveBeenCalledWith({
      pagId: '9007199254740993',
      patMarca: 'VISA',
      patUltimos4: '4242',
      patTitular: 'Cliente de prueba',
      patMes: 5,
      patAnio: 2030,
      patPais: 'EC',
    });
  });

  it('returns 404 for a missing payment', async () => {
    paymentRepository.findOne.mockResolvedValue(null);

    await expect(service.crear('42', request)).rejects.toThrow(
      NotFoundException,
    );
    expect(detailRepository.save).not.toHaveBeenCalled();
  });

  it('rejects incompatible method and non-pending state', async () => {
    paymentRepository.findOne
      .mockResolvedValueOnce(makePayment())
      .mockResolvedValueOnce(
        makePayment({
          metodoPago: Object.assign(new MetodoPago(), {
            mpaCodigo: 'TRANSFERENCIA',
          }),
        }),
      )
      .mockResolvedValueOnce(makePayment())
      .mockResolvedValueOnce(
        makePayment({
          estado: Object.assign(new Estado(), { estCodigo: 'APROBADO' }),
        }),
      );

    await expect(service.crear('42', request)).rejects.toThrow(
      UnprocessableEntityException,
    );
    await expect(service.crear('42', request)).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(detailRepository.save).not.toHaveBeenCalled();
  });

  it('returns 409 for an existing detail and for a concurrent unique-index collision', async () => {
    const detail = makeDetail();
    paymentRepository.findOne.mockResolvedValue(makePayment());
    detailRepository.findOneBy.mockResolvedValueOnce(detail);

    await expect(service.crear('9007199254740993', request)).rejects.toThrow(
      ConflictException,
    );

    detailRepository.findOneBy
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(detail);
    detailRepository.create.mockImplementation((values) =>
      Object.assign(new PagoTarjeta(), values),
    );
    detailRepository.save.mockRejectedValue(
      new QueryFailedError(
        'INSERT INTO pago_tarjeta',
        [],
        Object.assign(new Error(), { code: '23505' }),
      ),
    );

    await expect(service.crear('9007199254740993', request)).rejects.toThrow(
      ConflictException,
    );
  });

  it('returns 404 when the payment exists but its card detail does not', async () => {
    paymentRepository.findOne.mockResolvedValue(makePayment());
    detailRepository.findOneBy.mockResolvedValue(null);

    await expect(service.obtener('9007199254740993')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('blocks writes to the development database in test mode', async () => {
    configService.getOrThrow
      .mockReturnValueOnce('test')
      .mockReturnValueOnce('ms_payment');

    await expect(service.crear('42', request)).rejects.toThrow(
      ForbiddenException,
    );
    expect(paymentRepository.findOne).not.toHaveBeenCalled();
    expect(detailRepository.save).not.toHaveBeenCalled();
  });
});
