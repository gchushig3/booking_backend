import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MetodoPago } from './metodo_pago.entity.js';
import { MetodoPagoService } from './metodo_pago.service.js';

describe('MetodoPagoService', () => {
  let service: MetodoPagoService;
  const repository = {
    find: vi.fn<Repository<MetodoPago>['find']>(),
    findOneBy: vi.fn<Repository<MetodoPago>['findOneBy']>(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetodoPagoService,
        { provide: getRepositoryToken(MetodoPago), useValue: repository },
      ],
    }).compile();

    service = module.get(MetodoPagoService);
  });

  it('lists catalog entries in ascending id order and maps the OpenAPI response', async () => {
    repository.find.mockResolvedValue([
      {
        mpaId: 1,
        mpaCodigo: 'TARJETA',
        mpaNombre: 'Tarjeta de credito/debito',
        mpaRequiereDatos: true,
        mpaActivo: true,
      },
    ]);

    await expect(service.listar()).resolves.toEqual([
      {
        id: 1,
        codigo: 'TARJETA',
        nombre: 'Tarjeta de credito/debito',
        requiere_datos: true,
        activo: true,
      },
    ]);
    expect(repository.find).toHaveBeenCalledWith({
      where: {},
      order: { mpaId: 'ASC' },
    });
  });

  it('filters by active state when requested', async () => {
    repository.find.mockResolvedValue([]);

    await expect(service.listar(false)).resolves.toEqual([]);
    expect(repository.find).toHaveBeenCalledWith({
      where: { mpaActivo: false },
      order: { mpaId: 'ASC' },
    });
  });

  it('returns an existing method by id', async () => {
    repository.findOneBy.mockResolvedValue({
      mpaId: 4,
      mpaCodigo: 'PAYPHAL',
      mpaNombre: 'PayPal',
      mpaRequiereDatos: false,
      mpaActivo: true,
    });

    await expect(service.obtenerPorId(4)).resolves.toEqual({
      id: 4,
      codigo: 'PAYPHAL',
      nombre: 'PayPal',
      requiere_datos: false,
      activo: true,
    });
    expect(repository.findOneBy).toHaveBeenCalledWith({ mpaId: 4 });
  });

  it('throws NotFoundException when the method does not exist', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.obtenerPorId(32767)).rejects.toThrow(
      NotFoundException,
    );
  });
});
