import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdiomaEntity } from '../../database/entities/idioma.entity.js';
import { AtraccionIdiomaEntity } from '../../database/entities/atraccion-idioma.entity.js';
import { CatalogException } from '../../common/exceptions/catalog.exception.js';
import type { CreateLanguageDto } from './dto/create-language.dto.js';
import type { UpdateLanguageDto } from './dto/update-language.dto.js';
import {
  toLanguageResponseDto,
  type LanguageResponseDto,
} from './dto/language-response.dto.js';

@Injectable()
export class LanguagesService {
  constructor(
    @InjectRepository(IdiomaEntity)
    private readonly languageRepo: Repository<IdiomaEntity>,
    @InjectRepository(AtraccionIdiomaEntity)
    private readonly attractionLanguageRepo: Repository<AtraccionIdiomaEntity>,
  ) {}

  async findAll(): Promise<LanguageResponseDto[]> {
    const list = await this.languageRepo.find({
      order: { idi_codigo: 'ASC' },
    });
    return list.map(toLanguageResponseDto);
  }

  async findById(id: number): Promise<LanguageResponseDto> {
    const item = await this.languageRepo.findOne({
      where: { idi_id: id },
    });
    if (!item) {
      throw CatalogException.notFound(
        `Idioma con ID ${id} no encontrado`,
        'LANGUAGE_NOT_FOUND',
      );
    }
    return toLanguageResponseDto(item);
  }

  async create(dto: CreateLanguageDto): Promise<LanguageResponseDto> {
    const code = dto.code.toLowerCase().trim();
    const existing = await this.languageRepo.findOne({
      where: { idi_codigo: code },
    });
    if (existing) {
      throw CatalogException.conflict(
        `Ya existe un idioma con el código "${code}"`,
        'LANGUAGE_CODE_CONFLICT',
      );
    }

    const item = this.languageRepo.create({
      idi_codigo: code,
      idi_nombre: dto.name.trim(),
    });

    const saved = await this.languageRepo.save(item);
    return toLanguageResponseDto(saved);
  }

  async update(
    id: number,
    dto: UpdateLanguageDto,
  ): Promise<LanguageResponseDto> {
    const item = await this.languageRepo.findOne({
      where: { idi_id: id },
    });
    if (!item) {
      throw CatalogException.notFound(
        `Idioma con ID ${id} no encontrado`,
        'LANGUAGE_NOT_FOUND',
      );
    }

    if (dto.name !== undefined) {
      item.idi_nombre = dto.name.trim();
    }

    const saved = await this.languageRepo.save(item);
    return toLanguageResponseDto(saved);
  }

  async delete(id: number): Promise<void> {
    const item = await this.languageRepo.findOne({
      where: { idi_id: id },
    });
    if (!item) {
      throw CatalogException.notFound(
        `Idioma con ID ${id} no encontrado`,
        'LANGUAGE_NOT_FOUND',
      );
    }

    const count = await this.attractionLanguageRepo.count({
      where: { idi_id: id },
    });
    if (count > 0) {
      throw CatalogException.conflict(
        'No se puede eliminar el idioma porque está asociado a una o más atracciones',
        'LANGUAGE_HAS_ATTRACTIONS',
      );
    }

    await this.languageRepo.delete(id);
  }
}
