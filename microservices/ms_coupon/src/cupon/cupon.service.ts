import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cupon } from './cupon.entity.js';
import type { CreateCuponInput, UpdateCuponInput } from './cupon.schemas.js';

@Injectable()
export class CuponService {
  constructor(
    @InjectRepository(Cupon)
    private readonly cuponesRepository: Repository<Cupon>,
  ) {}

  findAll(): Promise<Cupon[]> {
    return this.cuponesRepository.find({ order: { cup_id: 'ASC' } });
  }

  async findOne(id: string | number): Promise<Cupon> {
    const cupon = await this.cuponesRepository.findOneBy({
      cup_id: String(id),
    });
    if (!cupon) {
      throw new NotFoundException(`Cupon con id ${id} no existe`);
    }
    return cupon;
  }

  async findByCodigo(cupCodigo: string): Promise<Cupon> {
    const cupon = await this.cuponesRepository.findOneBy({
      cup_codigo: cupCodigo,
    });
    if (!cupon) {
      throw new NotFoundException(`Cupon con codigo ${cupCodigo} no existe`);
    }
    return cupon;
  }

  async validate(code: string, date?: string) {
    const coupon = await this.findByCodigo(code);
    const today = date ?? new Date().toISOString().slice(0, 10);
    const valid =
      coupon.cup_activo &&
      coupon.cup_fecha_inicio <= today &&
      (coupon.cup_fecha_fin === null || coupon.cup_fecha_fin >= today);
    return {
      valido: valid,
      codigo: coupon.cup_codigo,
      tipo: coupon.cup_tipo,
      valor: coupon.cup_valor,
      vigente_desde: coupon.cup_fecha_inicio,
      vigente_hasta: coupon.cup_fecha_fin,
    };
  }

  async create(input: CreateCuponInput): Promise<Cupon> {
    try {
      return await this.cuponesRepository.save(
        this.cuponesRepository.create({
          ...input,
          cup_valor: String(input.cup_valor),
          cup_fecha_inicio: String(input.cup_fecha_inicio).slice(0, 10),
          cup_fecha_fin:
            input.cup_fecha_fin == null
              ? null
              : String(input.cup_fecha_fin).slice(0, 10),
        }),
      );
    } catch (error) {
      if (
        (error as { driverError?: { code?: string } })?.driverError?.code ===
        '23505'
      ) {
        throw new ConflictException('El codigo del cupon ya existe');
      }
      throw error;
    }
  }

  async update(
    id: string | number,
    updateCuponDto: UpdateCuponInput,
  ): Promise<Cupon> {
    const cupon = await this.findOne(id);
    const data = Object.assign(new Cupon(), cupon);
    if (updateCuponDto.cup_codigo !== undefined)
      data.cup_codigo = updateCuponDto.cup_codigo;
    if (updateCuponDto.cup_tipo !== undefined)
      data.cup_tipo = updateCuponDto.cup_tipo;
    if (updateCuponDto.cup_valor !== undefined)
      data.cup_valor = String(updateCuponDto.cup_valor);
    if (updateCuponDto.cup_fecha_inicio !== undefined)
      data.cup_fecha_inicio = String(updateCuponDto.cup_fecha_inicio).slice(
        0,
        10,
      );
    if (updateCuponDto.cup_fecha_fin !== undefined)
      data.cup_fecha_fin =
        updateCuponDto.cup_fecha_fin === null
          ? null
          : String(updateCuponDto.cup_fecha_fin).slice(0, 10);
    if (updateCuponDto.cup_usos_max !== undefined)
      data.cup_usos_max = updateCuponDto.cup_usos_max;
    if (updateCuponDto.cup_activo !== undefined)
      data.cup_activo = updateCuponDto.cup_activo;
    return this.cuponesRepository.save(data);
  }

  async remove(id: string | number): Promise<void> {
    const cupon = await this.findOne(id);
    await this.cuponesRepository.remove(cupon);
  }
}
