import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InclusionEntity } from '../../database/entities/inclusion.entity.js';
import { AtraccionInclusionEntity } from '../../database/entities/atraccion-inclusion.entity.js';
import { CatalogException } from '../../common/exceptions/catalog.exception.js';
import type { CreateInclusionDto } from './dto/create-inclusion.dto.js';
import type { UpdateInclusionDto } from './dto/update-inclusion.dto.js';
import type { FilterInclusionsQueryDto } from './dto/filter-inclusions-query.dto.js';
import {
  toInclusionResponseDto,
  type InclusionResponseDto,
} from './dto/inclusion-response.dto.js';

@Injectable()
export class InclusionsService {
  constructor(
    @InjectRepository(InclusionEntity)
    private readonly inclusionRepo: Repository<InclusionEntity>,
    @InjectRepository(AtraccionInclusionEntity)
    private readonly attractionInclusionRepo: Repository<AtraccionInclusionEntity>,
  ) {}

  async findAll(
    filter?: FilterInclusionsQueryDto,
  ): Promise<InclusionResponseDto[]> {
    const qb = this.inclusionRepo.createQueryBuilder('i');
    if (filter?.type) {
      qb.andWhere('i.inc_tipo = :tipo', { tipo: filter.type });
    }
    qb.orderBy('i.inc_tipo', 'ASC')
      .addOrderBy('i.inc_orden', 'ASC')
      .addOrderBy('i.inc_nombre', 'ASC');

    const list = await qb.getMany();
    return list.map(toInclusionResponseDto);
  }

  async findById(id: number): Promise<InclusionResponseDto> {
    const item = await this.inclusionRepo.findOne({
      where: { inc_id: id },
    });
    if (!item) {
      throw CatalogException.notFound(
        `Inclusión con ID ${id} no encontrada`,
        'INCLUSION_NOT_FOUND',
      );
    }
    return toInclusionResponseDto(item);
  }

  async create(dto: CreateInclusionDto): Promise<InclusionResponseDto> {
    const type = dto.type.toUpperCase().trim();
    const name = dto.name.trim();

    const existing = await this.inclusionRepo.findOne({
      where: { inc_tipo: type, inc_nombre: name },
    });
    if (existing) {
      throw CatalogException.conflict(
        `Ya existe una inclusión de tipo "${type}" con el nombre "${name}"`,
        'INCLUSION_CONFLICT',
      );
    }

    const item = this.inclusionRepo.create({
      inc_tipo: type,
      inc_nombre: name,
      inc_orden: dto.order ?? 0,
    });

    const saved = await this.inclusionRepo.save(item);
    return toInclusionResponseDto(saved);
  }

  async update(
    id: number,
    dto: UpdateInclusionDto,
  ): Promise<InclusionResponseDto> {
    const item = await this.inclusionRepo.findOne({
      where: { inc_id: id },
    });
    if (!item) {
      throw CatalogException.notFound(
        `Inclusión con ID ${id} no encontrada`,
        'INCLUSION_NOT_FOUND',
      );
    }

    const newType = dto.type ? dto.type.toUpperCase().trim() : item.inc_tipo;
    const newName = dto.name ? dto.name.trim() : item.inc_nombre;

    if (newType !== item.inc_tipo || newName !== item.inc_nombre) {
      const existing = await this.inclusionRepo.findOne({
        where: { inc_tipo: newType, inc_nombre: newName },
      });
      if (existing && existing.inc_id !== id) {
        throw CatalogException.conflict(
          `Ya existe otra inclusión de tipo "${newType}" con el nombre "${newName}"`,
          'INCLUSION_CONFLICT',
        );
      }
    }

    item.inc_tipo = newType;
    item.inc_nombre = newName;
    if (dto.order !== undefined) {
      item.inc_orden = dto.order;
    }

    const saved = await this.inclusionRepo.save(item);
    return toInclusionResponseDto(saved);
  }

  async delete(id: number): Promise<void> {
    const item = await this.inclusionRepo.findOne({
      where: { inc_id: id },
    });
    if (!item) {
      throw CatalogException.notFound(
        `Inclusión con ID ${id} no encontrada`,
        'INCLUSION_NOT_FOUND',
      );
    }

    const count = await this.attractionInclusionRepo.count({
      where: { inc_id: id },
    });
    if (count > 0) {
      throw CatalogException.conflict(
        'No se puede eliminar la inclusión porque está asociada a una o más atracciones',
        'INCLUSION_HAS_ATTRACTIONS',
      );
    }

    await this.inclusionRepo.delete(id);
  }
}
