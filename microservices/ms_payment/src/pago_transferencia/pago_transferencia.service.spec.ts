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
import { CrearDetalleTransferenciaRequestDto } from './dto/crear-detalle-transferencia-request.dto.js';
import { PagoTransferencia } from './pago_transferencia.entity.js';
import { PagoTransferenciaService } from './pago_transferencia.service.js';

describe('PagoTransferenciaService', () => {
  let service: PagoTransferenciaService;

  const detailRepository = {
    findOneBy: vi.fn<Repository<PagoTransferencia>['findOneBy']>(),
    create: vi.fn<Repository<PagoTransferencia>['create']>(),
    save: vi.fn<Repository<PagoTransferencia>['save']>(),
  };
  const transaction = vi.fn();
  const paymentRepository = {
    manager: { transaction },
    findOne: vi.fn<Repository<Pago>['findOne']>(),
  };
  const configService = {
    getOrThrow: vi.fn().mockReturnValue('development'),
  };

  const request: CrearDetalleTransferenciaRequestDto = {
    banco: 'Banco de prueba',
    numero_comprobante: 'COMPROBANTE-TEST-1',
    fecha_transferencia: '2026-10-27',
  };

  function makePayment(overrides: Partial<Pago> = {}): Pago {
    return Object.assign(new Pago(), {
      pagId: '9007199254740993',
      metodoPago: Object.assign(new MetodoPago(), {
        mpaCodigo: 'TRANSFERENCIA',
      }),
      estado: Object.assign(new Estado(), { estCodigo: 'PENDIENTE' }),
      ...overrides,
    });
  }

  function makeDetail(
    overrides: Partial<PagoTransferencia> = {},
  ): PagoTransferencia {
    return Object.assign(new PagoTransferencia(), {
      ptrId: '9007199254740997',
      pagId: '9007199254740993',
      ptrBanco: 'Banco de prueba',
      ptrNumeroComprobante: 'COMPROBANTE-TEST-1',
      ptrFechaTransferencia: '2026-10-27',
      ptrArchivoAdjunto: null,
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
        PagoTransferenciaService,
        {
          provide: getRepositoryToken(PagoTransferencia),
          useValue: detailRepository,
        },
        { provide: getRepositoryToken(Pago), useValue: paymentRepository },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();
    service = module.get(PagoTransferenciaService);
  });

  it('creates and serializes documented transfer fields with a nullable attachment', async () => {
    const saved = makeDetail();
    paymentRepository.findOne.mockResolvedValue(makePayment());
    detailRepository.findOneBy.mockResolvedValue(null);
    detailRepository.create.mockImplementation((values) =>
      Object.assign(new PagoTransferencia(), values),
    );
    detailRepository.save.mockResolvedValue(saved);

    await expect(
      service.crear('9007199254740993', {
        banco: request.banco,
        numero_comprobante: request.numero_comprobante,
        fecha_transferencia: request.fecha_transferencia,
        archivo_adjunto: 'referencias/comprobante.pdf',
      }),
    ).resolves.toEqual({
      id: '9007199254740997',
      pago_id: '9007199254740993',
      banco: 'Banco de prueba',
      numero_comprobante: 'COMPROBANTE-TEST-1',
      fecha_transferencia: '2026-10-27',
      archivo_adjunto: null,
    });
    expect(detailRepository.create).toHaveBeenCalledWith({
      pagId: '9007199254740993',
      ptrBanco: 'Banco de prueba',
      ptrNumeroComprobante: 'COMPROBANTE-TEST-1',
      ptrFechaTransferencia: '2026-10-27',
      ptrArchivoAdjunto: 'referencias/comprobante.pdf',
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
          metodoPago: Object.assign(new MetodoPago(), { mpaCodigo: 'TARJETA' }),
        }),
      )
      .mockResolvedValueOnce(makePayment())
      .mockResolvedValueOnce(
        makePayment({
          estado: Object.assign(new Estado(), { estCodigo: 'RECHAZADO' }),
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

  it('returns 409 for existing and concurrently inserted details', async () => {
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
      Object.assign(new PagoTransferencia(), values),
    );
    detailRepository.save.mockRejectedValue(
      new QueryFailedError(
        'INSERT INTO pago_transferencia',
        [],
        Object.assign(new Error(), { code: '23505' }),
      ),
    );

    await expect(service.crear('9007199254740993', request)).rejects.toThrow(
      ConflictException,
    );
  });

  it('returns 404 when the payment exists but its transfer detail does not', async () => {
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
