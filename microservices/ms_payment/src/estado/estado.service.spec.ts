import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Estado } from './estado.entity.js';
import { EstadoService } from './estado.service.js';

describe('EstadoService', () => {
  let service: EstadoService;
  const repository = {
    find: vi.fn<Repository<Estado>['find']>(),
    findOneBy: vi.fn<Repository<Estado>['findOneBy']>(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstadoService,
        { provide: getRepositoryToken(Estado), useValue: repository },
      ],
    }).compile();

    service = module.get(EstadoService);
  });

  it('lists catalog entries in ascending id order and maps the OpenAPI response', async () => {
    repository.find.mockResolvedValue([
      {
        estId: 1,
        estCodigo: 'PENDIENTE',
        estNombre: 'Pago pendiente',
        estFinal: false,
      },
    ]);

    await expect(service.listar()).resolves.toEqual([
      {
        id: 1,
        codigo: 'PENDIENTE',
        nombre: 'Pago pendiente',
        final: false,
      },
    ]);
    expect(repository.find).toHaveBeenCalledWith({
      order: { estId: 'ASC' },
    });
  });

  it('returns an existing status by id and preserves its database final flag', async () => {
    repository.findOneBy.mockResolvedValue({
      estId: 2,
      estCodigo: 'APROBADO',
      estNombre: 'Pago aprobado',
      estFinal: true,
    });

    await expect(service.obtenerPorId(2)).resolves.toEqual({
      id: 2,
      codigo: 'APROBADO',
      nombre: 'Pago aprobado',
      final: true,
    });
    expect(repository.findOneBy).toHaveBeenCalledWith({ estId: 2 });
  });

  it('throws NotFoundException when the status does not exist', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.obtenerPorId(32767)).rejects.toThrow(
      NotFoundException,
    );
  });
});
