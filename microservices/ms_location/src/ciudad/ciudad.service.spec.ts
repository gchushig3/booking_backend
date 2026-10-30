import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CiudadService } from './ciudad.service.js';
import { Ciudad } from './ciudad.entity.js';
import { CreateCiudadDto } from './dto/create-ciudad.dto.js';
import { UpdateCiudadDto } from './dto/update-ciudad.dto.js';

describe('CiudadService', () => {
  let service: CiudadService;
  let repository: Repository<Ciudad>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CiudadService,
        {
          provide: getRepositoryToken(Ciudad),
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

    service = module.get<CiudadService>(CiudadService);
    repository = module.get<Repository<Ciudad>>(getRepositoryToken(Ciudad));
  });

  it('findAll sin filtro debe delegar en el repositorio', async () => {
    const ciudades = [
      { ciu_id: 1, ciu_nombre: 'Cuenca', ciu_codigo: '010100', prov_id: 1 },
    ];
    vi.mocked(repository.find).mockResolvedValue(ciudades);

    expect(await service.findAll()).toBe(ciudades);
    expect(repository.find).toHaveBeenCalled();
  });

  it('findAll con provId debe filtrar por prov_id', async () => {
    const ciudades = [
      { ciu_id: 1, ciu_nombre: 'Cuenca', ciu_codigo: '010100', prov_id: 1 },
    ];
    vi.mocked(repository.find).mockResolvedValue(ciudades);

    expect(await service.findAll(1)).toBe(ciudades);
    expect(repository.find).toHaveBeenCalledWith({
      where: { prov_id: 1 },
      order: { ciu_id: 'ASC' },
    });
  });

  it('findOne debe lanzar NotFoundException cuando no existe', async () => {
    vi.mocked(repository.findOneBy).mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('create debe persistir la ciudad', async () => {
    const dto: CreateCiudadDto = {
      prov_id: 1,
      ciu_nombre: 'Cuenca',
      ciu_codigo: '010100',
    };
    const ciudad = { ciu_id: 1, ...dto };
    vi.mocked(repository.create).mockReturnValue(ciudad as Ciudad);
    vi.mocked(repository.save).mockResolvedValue(ciudad);

    await expect(service.create(dto)).resolves.toBe(ciudad);
    expect(repository.save).toHaveBeenCalled();
  });

  it('update debe reemplazar los datos de la ciudad', async () => {
    const existing = {
      ciu_id: 1,
      ciu_nombre: 'Cuenca',
      ciu_codigo: '010100',
      prov_id: 1,
    };
    const dto: UpdateCiudadDto = { ciu_nombre: 'Cuenca Centro' };
    vi.mocked(repository.findOneBy).mockResolvedValue(existing);
    vi.mocked(repository.create).mockReturnValue({
      ...existing,
      ...dto,
    } as Ciudad);
    vi.mocked(repository.save).mockResolvedValue({
      ...existing,
      ...dto,
    } as Ciudad);

    await expect(service.update(1, dto)).resolves.toEqual({
      ...existing,
      ...dto,
    });
  });

  it('remove debe eliminar la ciudad', async () => {
    const ciudad = {
      ciu_id: 1,
      ciu_nombre: 'Cuenca',
      ciu_codigo: '010100',
      prov_id: 1,
    };
    vi.mocked(repository.findOneBy).mockResolvedValue(ciudad);
    vi.mocked(repository.remove).mockResolvedValue(ciudad);

    await expect(service.remove(1)).resolves.toBeUndefined();
    expect(repository.remove).toHaveBeenCalledWith(ciudad);
  });
});
