import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CuponService } from './cupon.service.js';
import { Cupon } from './cupon.entity.js';
import { CreateCuponDto } from './dto/create-cupon.dto.js';
import { UpdateCuponDto } from './dto/update-cupon.dto.js';

describe('CuponService', () => {
  let service: CuponService;
  let repository: Repository<Cupon>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CuponService,
        {
          provide: getRepositoryToken(Cupon),
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

    service = module.get<CuponService>(CuponService);
    repository = module.get<Repository<Cupon>>(getRepositoryToken(Cupon));
  });

  it('findAll debe delegar en el repositorio', async () => {
    const cupones = [
      {
        cup_id: 1,
        cup_codigo: 'DESCUENTO10',
        cup_tipo: 'PORCENTAJE',
        cup_valor: 10,
      },
    ];
    vi.mocked(repository.find).mockResolvedValue(cupones);

    expect(await service.findAll()).toBe(cupones);
    expect(repository.find).toHaveBeenCalled();
  });

  it('findOne debe retornar el cupon cuando existe', async () => {
    const cupon = {
      cup_id: 1,
      cup_codigo: 'DESCUENTO10',
      cup_tipo: 'PORCENTAJE',
      cup_valor: 10,
    };
    vi.mocked(repository.findOneBy).mockResolvedValue(cupon);

    await expect(service.findOne(1)).resolves.toBe(cupon);
  });

  it('findOne debe lanzar NotFoundException cuando no existe', async () => {
    vi.mocked(repository.findOneBy).mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('findByCodigo debe retornar el cupon cuando existe', async () => {
    const cupon = {
      cup_id: 1,
      cup_codigo: 'DESCUENTO10',
      cup_tipo: 'PORCENTAJE',
      cup_valor: 10,
    };
    vi.mocked(repository.findOneBy).mockResolvedValue(cupon);

    await expect(service.findByCodigo('DESCUENTO10')).resolves.toBe(cupon);
  });

  it('findByCodigo debe lanzar NotFoundException cuando no existe', async () => {
    vi.mocked(repository.findOneBy).mockResolvedValue(null);

    await expect(service.findByCodigo('NOEXISTE')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('validate compara vigencia y activo para la fecha solicitada', async () => {
    const coupon: Cupon = {
      cup_id: '1',
      cup_codigo: 'DESCUENTO10',
      cup_tipo: 'PORCENTAJE',
      cup_valor: '10',
      cup_fecha_inicio: '2026-01-01',
      cup_fecha_fin: '2026-12-31',
      cup_usos_max: null,
      cup_activo: true,
    };
    vi.mocked(repository.findOneBy).mockResolvedValue(coupon);
    await expect(
      service.validate('DESCUENTO10', '2026-10-30'),
    ).resolves.toMatchObject({
      valido: true,
      codigo: 'DESCUENTO10',
    });
    await expect(
      service.validate('DESCUENTO10', '2027-01-01'),
    ).resolves.toMatchObject({
      valido: false,
    });
  });

  it('create debe persistir el cupon', async () => {
    const dto: CreateCuponDto = {
      cup_codigo: 'DESCUENTO10',
      cup_tipo: 'PORCENTAJE',
      cup_valor: 10,
      cup_fecha_inicio: new Date('2026-11-01'),
    };
    const cupon = { cup_id: 1, ...dto };
    vi.mocked(repository.create).mockReturnValue(cupon as Cupon);
    vi.mocked(repository.save).mockResolvedValue(cupon);

    await expect(service.create(dto)).resolves.toBe(cupon);
    expect(repository.save).toHaveBeenCalled();
  });

  it('update debe reemplazar los datos del cupon', async () => {
    const existing = {
      cup_id: 1,
      cup_codigo: 'DESCUENTO10',
      cup_tipo: 'PORCENTAJE',
      cup_valor: 10,
      cup_fecha_inicio: new Date('2026-11-01'),
    };
    const dto: UpdateCuponDto = { cup_valor: 20 };
    vi.mocked(repository.findOneBy).mockResolvedValue(existing);
    vi.mocked(repository.create).mockReturnValue({
      ...existing,
      ...dto,
    } as Cupon);
    vi.mocked(repository.save).mockResolvedValue({
      ...existing,
      ...dto,
    } as Cupon);

    await expect(service.update(1, dto)).resolves.toEqual({
      ...existing,
      ...dto,
    });
  });

  it('remove debe eliminar el cupon', async () => {
    const cupon = {
      cup_id: 1,
      cup_codigo: 'DESCUENTO10',
      cup_tipo: 'PORCENTAJE',
      cup_valor: 10,
    };
    vi.mocked(repository.findOneBy).mockResolvedValue(cupon);
    vi.mocked(repository.remove).mockResolvedValue(cupon);

    await expect(service.remove(1)).resolves.toBeUndefined();
    expect(repository.remove).toHaveBeenCalledWith(cupon);
  });
});
