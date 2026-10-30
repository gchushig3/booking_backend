import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RegionService } from './region.service.js';
import { Region } from './region.entity.js';
import { CreateRegionDto } from './dto/create-region.dto.js';
import { UpdateRegionDto } from './dto/update-region.dto.js';

describe('RegionService', () => {
  let service: RegionService;
  let repository: Repository<Region>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegionService,
        {
          provide: getRepositoryToken(Region),
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

    service = module.get<RegionService>(RegionService);
    repository = module.get<Repository<Region>>(getRepositoryToken(Region));
  });

  it('findAll debe delegar en el repositorio', async () => {
    const regions = [{ reg_id: 1, reg_nombre: 'SIERRA', reg_codigo: 'SI' }];
    vi.mocked(repository.find).mockResolvedValue(regions);

    expect(await service.findAll()).toBe(regions);
    expect(repository.find).toHaveBeenCalled();
  });

  it('findOne debe retornar la region cuando existe', async () => {
    const region = { reg_id: 1, reg_nombre: 'SIERRA', reg_codigo: 'SI' };
    vi.mocked(repository.findOneBy).mockResolvedValue(region);

    await expect(service.findOne(1)).resolves.toBe(region);
  });

  it('findOne debe lanzar NotFoundException cuando no existe', async () => {
    vi.mocked(repository.findOneBy).mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('create debe persistir la region', async () => {
    const dto: CreateRegionDto = { reg_nombre: 'SIERRA', reg_codigo: 'SI' };
    const region = { reg_id: 1, ...dto };
    vi.mocked(repository.create).mockReturnValue(region as Region);
    vi.mocked(repository.save).mockResolvedValue(region);

    await expect(service.create(dto)).resolves.toBe(region);
    expect(repository.save).toHaveBeenCalled();
  });

  it('update debe reemplazar los datos de la region', async () => {
    const existing = { reg_id: 1, reg_nombre: 'SIERRA', reg_codigo: 'SI' };
    const dto: UpdateRegionDto = { reg_nombre: 'COSTA' };
    vi.mocked(repository.findOneBy).mockResolvedValue(existing);
    vi.mocked(repository.create).mockReturnValue({
      ...existing,
      ...dto,
    } as Region);
    vi.mocked(repository.save).mockResolvedValue({
      ...existing,
      ...dto,
    } as Region);

    await expect(service.update(1, dto)).resolves.toEqual({
      ...existing,
      ...dto,
    });
  });

  it('remove debe eliminar la region', async () => {
    const region = { reg_id: 1, reg_nombre: 'SIERRA', reg_codigo: 'SI' };
    vi.mocked(repository.findOneBy).mockResolvedValue(region);
    vi.mocked(repository.remove).mockResolvedValue(region);

    await expect(service.remove(1)).resolves.toBeUndefined();
    expect(repository.remove).toHaveBeenCalledWith(region);
  });
});
