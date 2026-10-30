import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProvinciaService } from './provincia.service.js';
import { Provincia } from './provincia.entity.js';
import { CreateProvinciaDto } from './dto/create-provincia.dto.js';
import { UpdateProvinciaDto } from './dto/update-provincia.dto.js';

describe('ProvinciaService', () => {
  let service: ProvinciaService;
  let repository: Repository<Provincia>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvinciaService,
        {
          provide: getRepositoryToken(Provincia),
          useValue: {
            find: vi.fn(),
            findOneBy: vi.fn(),
            create: vi.fn(),
            save: vi.fn(),
            remove: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProvinciaService>(ProvinciaService);
    repository = module.get<Repository<Provincia>>(
      getRepositoryToken(Provincia),
    );
  });

  it('findAll sin filtro debe delegar en el repositorio', async () => {
    const provincias = [
      { prov_id: 1, prov_nombre: 'Azuay', prov_codigo: '01', reg_id: 1 },
    ];
    vi.mocked(repository.find).mockResolvedValue(provincias);

    expect(await service.findAll()).toBe(provincias);
    expect(repository.find).toHaveBeenCalled();
  });

  it('findAll con regId debe filtrar por reg_id', async () => {
    const provincias = [
      { prov_id: 1, prov_nombre: 'Azuay', prov_codigo: '01', reg_id: 1 },
    ];
    vi.mocked(repository.find).mockResolvedValue(provincias);

    expect(await service.findAll(1)).toBe(provincias);
    expect(repository.find).toHaveBeenCalledWith({
      where: { reg_id: 1 },
      order: { prov_id: 'ASC' },
    });
  });

  it('findOne debe lanzar NotFoundException cuando no existe', async () => {
    vi.mocked(repository.findOneBy).mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('create debe persistir la provincia', async () => {
    const dto: CreateProvinciaDto = {
      reg_id: 1,
      prov_nombre: 'Azuay',
      prov_codigo: '01',
    };
    const provincia = { prov_id: 1, ...dto };
    vi.mocked(repository.create).mockReturnValue(provincia as Provincia);
    vi.mocked(repository.save).mockResolvedValue(provincia);

    await expect(service.create(dto)).resolves.toBe(provincia);
    expect(repository.save).toHaveBeenCalled();
  });

  it('update debe reemplazar los datos de la provincia', async () => {
    const existing = {
      prov_id: 1,
      prov_nombre: 'Azuay',
      prov_codigo: '01',
      reg_id: 1,
    };
    const dto: UpdateProvinciaDto = { prov_nombre: 'Cuenca' };
    vi.mocked(repository.findOneBy).mockResolvedValue(existing);
    vi.mocked(repository.create).mockReturnValue({
      ...existing,
      ...dto,
    } as Provincia);
    vi.mocked(repository.save).mockResolvedValue({
      ...existing,
      ...dto,
    } as Provincia);

    await expect(service.update(1, dto)).resolves.toEqual({
      ...existing,
      ...dto,
    });
  });

  it('remove debe eliminar la provincia', async () => {
    const provincia = {
      prov_id: 1,
      prov_nombre: 'Azuay',
      prov_codigo: '01',
      reg_id: 1,
    };
    vi.mocked(repository.findOneBy).mockResolvedValue(provincia);
    vi.mocked(repository.remove).mockResolvedValue(provincia);

    await expect(service.remove(1)).resolves.toBeUndefined();
    expect(repository.remove).toHaveBeenCalledWith(provincia);
  });
});
