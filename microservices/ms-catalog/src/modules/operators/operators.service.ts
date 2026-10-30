import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperadorEntity } from '../../database/entities/operador.entity.js';
import { OperadorUsuarioEntity } from '../../database/entities/operador-usuario.entity.js';
import { AtraccionEntity } from '../../database/entities/atraccion.entity.js';
import { CatalogException } from '../../common/exceptions/catalog.exception.js';
import {
  buildPaginatedResponse,
  type PaginatedResponse,
} from '../../common/pagination/paginated-response.dto.js';
import type { CreateOperatorDto } from './dto/create-operator.dto.js';
import type { UpdateOperatorDto } from './dto/update-operator.dto.js';
import type { FilterOperatorsQueryDto } from './dto/filter-operators-query.dto.js';
import type {
  AssociateOperatorUserDto,
  OperatorUserResponseDto,
  UpdateOperatorUserDto,
} from './dto/operator-user.dto.js';
import {
  toOperatorResponseDto,
  toOperatorUserResponseDto,
  type OperatorResponseDto,
} from './dto/operator-response.dto.js';

@Injectable()
export class OperatorsService {
  constructor(
    @InjectRepository(OperadorEntity)
    private readonly operatorRepo: Repository<OperadorEntity>,
    @InjectRepository(OperadorUsuarioEntity)
    private readonly operatorUserRepo: Repository<OperadorUsuarioEntity>,
    @InjectRepository(AtraccionEntity)
    private readonly attractionRepo: Repository<AtraccionEntity>,
  ) {}

  async findAll(
    filter?: FilterOperatorsQueryDto,
  ): Promise<PaginatedResponse<OperatorResponseDto>> {
    const page = Math.max(1, filter?.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter?.limit ?? 10));
    const skip = (page - 1) * limit;

    const qb = this.operatorRepo.createQueryBuilder('o');

    if (filter?.active !== undefined) {
      qb.andWhere('o.ope_activo = :activo', { activo: filter.active });
    }

    if (filter?.province_id !== undefined) {
      qb.andWhere('o.prov_id = :provId', { provId: filter.province_id });
    }

    if (filter?.search?.trim()) {
      qb.andWhere(
        '(o.ope_nombre ILIKE :search OR o.ope_ruc ILIKE :search OR o.ope_correo ILIKE :search)',
        { search: `%${filter.search.trim()}%` },
      );
    }

    qb.orderBy('o.ope_id', 'ASC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedResponse(
      items.map(toOperatorResponseDto),
      total,
      page,
      limit,
    );
  }

  async findById(idOrCode: string | number): Promise<OperatorResponseDto> {
    const qb = this.operatorRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.usuarios', 'u');

    if (typeof idOrCode === 'number' || /^\d+$/.test(String(idOrCode))) {
      qb.where('o.ope_id = :val OR o.ope_codigo = :codeVal', {
        val: String(idOrCode),
        codeVal: Number(idOrCode),
      });
    } else {
      qb.where('o.ope_id = :val', { val: String(idOrCode) });
    }

    const item = await qb.getOne();
    if (!item) {
      throw CatalogException.notFound(
        `Operador con identificador ${idOrCode} no encontrado`,
        'OPERATOR_NOT_FOUND',
      );
    }
    return toOperatorResponseDto(item);
  }

  async create(dto: CreateOperatorDto): Promise<OperatorResponseDto> {
    const existingCode = await this.operatorRepo.findOne({
      where: { ope_codigo: dto.code },
    });
    if (existingCode) {
      throw CatalogException.conflict(
        `Ya existe un operador con el código ${dto.code}`,
        'OPERATOR_CODE_CONFLICT',
      );
    }

    if (dto.ruc?.trim()) {
      const existingRuc = await this.operatorRepo.findOne({
        where: { ope_ruc: dto.ruc.trim() },
      });
      if (existingRuc) {
        throw CatalogException.conflict(
          `Ya existe un operador con el RUC ${dto.ruc.trim()}`,
          'OPERATOR_RUC_CONFLICT',
        );
      }
    }

    const item = this.operatorRepo.create({
      ope_codigo: dto.code,
      ope_nombre: dto.name.trim(),
      ope_ruc: dto.ruc?.trim() || null,
      ope_correo: dto.email?.trim() || null,
      ope_telefono: dto.phone?.trim() || null,
      ope_direccion: dto.address?.trim() || null,
      prov_id: dto.province_id,
      ope_activo: dto.active ?? true,
    });

    const saved = await this.operatorRepo.save(item);
    return toOperatorResponseDto(saved);
  }

  async update(
    id: string,
    dto: UpdateOperatorDto,
  ): Promise<OperatorResponseDto> {
    const item = await this.operatorRepo.findOne({
      where: { ope_id: id },
    });
    if (!item) {
      throw CatalogException.notFound(
        `Operador con ID ${id} no encontrado`,
        'OPERATOR_NOT_FOUND',
      );
    }

    if (dto.code !== undefined && dto.code !== item.ope_codigo) {
      const existingCode = await this.operatorRepo.findOne({
        where: { ope_codigo: dto.code },
      });
      if (existingCode && existingCode.ope_id !== id) {
        throw CatalogException.conflict(
          `Ya existe otro operador con el código ${dto.code}`,
          'OPERATOR_CODE_CONFLICT',
        );
      }
      item.ope_codigo = dto.code;
    }

    if (dto.ruc !== undefined) {
      const rucVal = dto.ruc?.trim() || null;
      if (rucVal && rucVal !== item.ope_ruc) {
        const existingRuc = await this.operatorRepo.findOne({
          where: { ope_ruc: rucVal },
        });
        if (existingRuc && existingRuc.ope_id !== id) {
          throw CatalogException.conflict(
            `Ya existe otro operador con el RUC ${rucVal}`,
            'OPERATOR_RUC_CONFLICT',
          );
        }
      }
      item.ope_ruc = rucVal;
    }

    if (dto.name !== undefined) item.ope_nombre = dto.name.trim();
    if (dto.email !== undefined) item.ope_correo = dto.email?.trim() || null;
    if (dto.phone !== undefined) item.ope_telefono = dto.phone?.trim() || null;
    if (dto.address !== undefined)
      item.ope_direccion = dto.address?.trim() || null;
    if (dto.province_id !== undefined) item.prov_id = dto.province_id;
    if (dto.active !== undefined) item.ope_activo = dto.active;

    const saved = await this.operatorRepo.save(item);
    return toOperatorResponseDto(saved);
  }

  async delete(id: string): Promise<void> {
    const item = await this.operatorRepo.findOne({
      where: { ope_id: id },
    });
    if (!item) {
      throw CatalogException.notFound(
        `Operador con ID ${id} no encontrado`,
        'OPERATOR_NOT_FOUND',
      );
    }

    const attractionsCount = await this.attractionRepo.count({
      where: { ope_id: id },
    });
    if (attractionsCount > 0) {
      // Si tiene atracciones, realizamos desactivación lógica
      item.ope_activo = false;
      await this.operatorRepo.save(item);
      return;
    }

    await this.operatorRepo.delete(id);
  }

  // Operator Users (operador_usuario)
  async listUsers(operatorId: string): Promise<OperatorUserResponseDto[]> {
    await this.findById(operatorId);
    const users = await this.operatorUserRepo.find({
      where: { ope_id: operatorId },
    });
    return users.map(toOperatorUserResponseDto);
  }

  async associateUser(
    operatorId: string,
    dto: AssociateOperatorUserDto,
  ): Promise<OperatorUserResponseDto> {
    await this.findById(operatorId);

    const existing = await this.operatorUserRepo.findOne({
      where: { ope_id: operatorId, usu_id: dto.user_id },
    });
    if (existing) {
      throw CatalogException.conflict(
        `El usuario con ID ${dto.user_id} ya está asociado al operador ${operatorId}`,
        'OPERATOR_USER_ALREADY_EXISTS',
      );
    }

    const association = this.operatorUserRepo.create({
      ope_id: operatorId,
      usu_id: dto.user_id,
      opeu_cargo: dto.role,
      opeu_activo: dto.active ?? true,
    });

    const saved = await this.operatorUserRepo.save(association);
    return toOperatorUserResponseDto(saved);
  }

  async updateUser(
    operatorId: string,
    userId: string,
    dto: UpdateOperatorUserDto,
  ): Promise<OperatorUserResponseDto> {
    const association = await this.operatorUserRepo.findOne({
      where: { ope_id: operatorId, usu_id: userId },
    });
    if (!association) {
      throw CatalogException.notFound(
        `Asociación del usuario ${userId} con el operador ${operatorId} no encontrada`,
        'OPERATOR_USER_NOT_FOUND',
      );
    }

    if (dto.role !== undefined) association.opeu_cargo = dto.role;
    if (dto.active !== undefined) association.opeu_activo = dto.active;

    const saved = await this.operatorUserRepo.save(association);
    return toOperatorUserResponseDto(saved);
  }

  async removeUser(operatorId: string, userId: string): Promise<void> {
    const association = await this.operatorUserRepo.findOne({
      where: { ope_id: operatorId, usu_id: userId },
    });
    if (!association) {
      throw CatalogException.notFound(
        `Asociación del usuario ${userId} con el operador ${operatorId} no encontrada`,
        'OPERATOR_USER_NOT_FOUND',
      );
    }

    await this.operatorUserRepo.delete({ ope_id: operatorId, usu_id: userId });
  }
}
