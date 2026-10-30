import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { AtraccionEntity } from '../../database/entities/atraccion.entity.js';
import { AtraccionCategoriaEntity } from '../../database/entities/atraccion-categoria.entity.js';
import { AtraccionIdiomaEntity } from '../../database/entities/atraccion-idioma.entity.js';
import { AtraccionInclusionEntity } from '../../database/entities/atraccion-inclusion.entity.js';
import { AtraccionFotoEntity } from '../../database/entities/atraccion-foto.entity.js';
import { OperadorEntity } from '../../database/entities/operador.entity.js';
import { CategoriaEntity } from '../../database/entities/categoria.entity.js';
import { IdiomaEntity } from '../../database/entities/idioma.entity.js';
import { InclusionEntity } from '../../database/entities/inclusion.entity.js';
import { CatalogException } from '../../common/exceptions/catalog.exception.js';
import {
  buildPaginatedResponse,
  type PaginatedResponse,
} from '../../common/pagination/paginated-response.dto.js';
import type { CreateAttractionDto } from './dto/create-attraction.dto.js';
import type { UpdateAttractionDto } from './dto/update-attraction.dto.js';
import type { FilterAttractionsQueryDto } from './dto/filter-attractions-query.dto.js';
import type { SearchAttractionsDto } from './dto/search-attractions.dto.js';
import type {
  CreatePhotoDto,
  PhotoResponseDto,
  UpdatePhotoDto,
} from './dto/photo.dto.js';
import { toPhotoResponseDto } from './dto/photo.dto.js';
import {
  toAttractionResponseDto,
  type AttractionCategorySummary,
  type AttractionInclusionSummary,
  type AttractionLanguageSummary,
  type AttractionResponseDto,
} from './dto/attraction-response.dto.js';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isBigintIdentifier(value: string): boolean {
  return /^\d+$/.test(value) && BigInt(value) <= 9223372036854775807n;
}

@Injectable()
export class AttractionsService {
  constructor(
    @InjectRepository(AtraccionEntity)
    private readonly attractionRepo: Repository<AtraccionEntity>,
    @InjectRepository(AtraccionCategoriaEntity)
    private readonly attractionCategoryRepo: Repository<AtraccionCategoriaEntity>,
    @InjectRepository(AtraccionIdiomaEntity)
    private readonly attractionLanguageRepo: Repository<AtraccionIdiomaEntity>,
    @InjectRepository(AtraccionInclusionEntity)
    private readonly attractionInclusionRepo: Repository<AtraccionInclusionEntity>,
    @InjectRepository(AtraccionFotoEntity)
    private readonly attractionPhotoRepo: Repository<AtraccionFotoEntity>,
    @InjectRepository(OperadorEntity)
    private readonly operatorRepo: Repository<OperadorEntity>,
    @InjectRepository(CategoriaEntity)
    private readonly categoryRepo: Repository<CategoriaEntity>,
    @InjectRepository(IdiomaEntity)
    private readonly languageRepo: Repository<IdiomaEntity>,
    @InjectRepository(InclusionEntity)
    private readonly inclusionRepo: Repository<InclusionEntity>,
    private readonly dataSource: DataSource,
  ) {}

  // 1. Consultas públicas
  async findPublic(
    filter?: FilterAttractionsQueryDto,
  ): Promise<PaginatedResponse<AttractionResponseDto>> {
    const page = Math.max(1, filter?.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter?.limit ?? 10));
    const skip = (page - 1) * limit;

    const qb = this.attractionRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.operador', 'o')
      .leftJoinAndSelect('a.categorias', 'ac')
      .leftJoinAndSelect('ac.categoria', 'c')
      .leftJoinAndSelect('a.idiomas', 'ai')
      .leftJoinAndSelect('ai.idioma', 'i')
      .leftJoinAndSelect('a.inclusiones', 'ainc')
      .leftJoinAndSelect('ainc.inclusion', 'inc')
      .leftJoinAndSelect('a.fotos', 'f')
      .where('a.atr_estado = :estado', { estado: 'PUBLICADA' })
      .andWhere('a.atr_eliminado_en IS NULL');

    if (filter?.city_id !== undefined) {
      qb.andWhere('a.ciu_id = :cityId', { cityId: filter.city_id });
    }

    if (filter?.operator_id?.trim()) {
      qb.andWhere('a.ope_id = :operatorId', {
        operatorId: filter.operator_id.trim(),
      });
    }

    if (filter?.type?.trim()) {
      qb.andWhere('a.atr_tipo = :type', { type: filter.type.trim() });
    }

    if (filter?.featured !== undefined) {
      qb.andWhere('a.atr_destacada = :featured', { featured: filter.featured });
    }

    if (filter?.category_id !== undefined) {
      qb.innerJoin('a.categorias', 'filter_cat', 'filter_cat.cat_id = :catId', {
        catId: filter.category_id,
      });
    }

    if (filter?.search?.trim()) {
      qb.andWhere(
        '(a.atr_nombre ILIKE :search OR a.atr_descripcion ILIKE :search)',
        { search: `%${filter.search.trim()}%` },
      );
    }

    qb.orderBy('a.atr_id', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedResponse(
      items.map(toAttractionResponseDto),
      total,
      page,
      limit,
    );
  }

  async findPublicById(idOrUuidOrSlug: string): Promise<AttractionResponseDto> {
    const qb = this.attractionRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.operador', 'o')
      .leftJoinAndSelect('a.categorias', 'ac')
      .leftJoinAndSelect('ac.categoria', 'c')
      .leftJoinAndSelect('a.idiomas', 'ai')
      .leftJoinAndSelect('ai.idioma', 'i')
      .leftJoinAndSelect('a.inclusiones', 'ainc')
      .leftJoinAndSelect('ainc.inclusion', 'inc')
      .leftJoinAndSelect('a.fotos', 'f')
      .where('a.atr_estado = :estado', { estado: 'PUBLICADA' })
      .andWhere('a.atr_eliminado_en IS NULL');

    if (UUID_REGEX.test(idOrUuidOrSlug)) {
      qb.andWhere('a.atr_uuid = :val', { val: idOrUuidOrSlug });
    } else if (isBigintIdentifier(idOrUuidOrSlug)) {
      qb.andWhere('(a.atr_id = :idValue OR a.atr_slug = :slugValue)', {
        idValue: idOrUuidOrSlug,
        slugValue: idOrUuidOrSlug,
      });
    } else {
      qb.andWhere('a.atr_slug = :val', { val: idOrUuidOrSlug });
    }

    const item = await qb.getOne();
    if (!item) {
      throw CatalogException.notFound(
        `Atracción con identificador "${idOrUuidOrSlug}" no encontrada o no disponible públicamente`,
        'ATTRACTION_NOT_FOUND',
      );
    }

    return toAttractionResponseDto(item);
  }

  async searchPublic(
    dto: SearchAttractionsDto,
  ): Promise<PaginatedResponse<AttractionResponseDto>> {
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(100, Math.max(1, dto.limit ?? 10));
    const skip = (page - 1) * limit;

    const qb = this.attractionRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.operador', 'o')
      .leftJoinAndSelect('a.categorias', 'ac')
      .leftJoinAndSelect('ac.categoria', 'c')
      .leftJoinAndSelect('a.idiomas', 'ai')
      .leftJoinAndSelect('ai.idioma', 'i')
      .leftJoinAndSelect('a.inclusiones', 'ainc')
      .leftJoinAndSelect('ainc.inclusion', 'inc')
      .leftJoinAndSelect('a.fotos', 'f')
      .where('a.atr_estado = :estado', { estado: 'PUBLICADA' })
      .andWhere('a.atr_eliminado_en IS NULL');

    if (dto.query?.trim()) {
      qb.andWhere(
        '(a.atr_nombre ILIKE :search OR a.atr_descripcion ILIKE :search)',
        { search: `%${dto.query.trim()}%` },
      );
    }

    if (dto.city_id !== undefined) {
      qb.andWhere('a.ciu_id = :cityId', { cityId: dto.city_id });
    }

    if (dto.type?.trim()) {
      qb.andWhere('a.atr_tipo = :type', { type: dto.type.trim() });
    }

    if (dto.featured !== undefined) {
      qb.andWhere('a.atr_destacada = :featured', { featured: dto.featured });
    }

    if (dto.category_id !== undefined) {
      qb.innerJoin(
        'a.categorias',
        'search_cat_id',
        'search_cat_id.cat_id = :catId',
        { catId: dto.category_id },
      );
    } else if (dto.category_slug?.trim()) {
      qb.innerJoin('a.categorias', 'search_cat_rel').innerJoin(
        'search_cat_rel.categoria',
        'search_c',
        'search_c.cat_slug = :catSlug',
        { catSlug: dto.category_slug.trim() },
      );
    }

    qb.orderBy('a.atr_id', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedResponse(
      items.map(toAttractionResponseDto),
      total,
      page,
      limit,
    );
  }

  // 2. Administración de atracciones
  async findById(
    idOrUuidOrSlug: string,
    includeDeleted: boolean = false,
  ): Promise<AtraccionEntity> {
    const qb = this.attractionRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.operador', 'o')
      .leftJoinAndSelect('a.categorias', 'ac')
      .leftJoinAndSelect('ac.categoria', 'c')
      .leftJoinAndSelect('a.idiomas', 'ai')
      .leftJoinAndSelect('ai.idioma', 'i')
      .leftJoinAndSelect('a.inclusiones', 'ainc')
      .leftJoinAndSelect('ainc.inclusion', 'inc')
      .leftJoinAndSelect('a.fotos', 'f');

    if (!includeDeleted) {
      qb.andWhere('a.atr_eliminado_en IS NULL');
    }

    if (UUID_REGEX.test(idOrUuidOrSlug)) {
      qb.andWhere('a.atr_uuid = :val', { val: idOrUuidOrSlug });
    } else if (isBigintIdentifier(idOrUuidOrSlug)) {
      qb.andWhere('(a.atr_id = :idValue OR a.atr_slug = :slugValue)', {
        idValue: idOrUuidOrSlug,
        slugValue: idOrUuidOrSlug,
      });
    } else {
      qb.andWhere('a.atr_slug = :val', { val: idOrUuidOrSlug });
    }

    const item = await qb.getOne();
    if (!item) {
      throw CatalogException.notFound(
        `Atracción con identificador "${idOrUuidOrSlug}" no encontrada`,
        'ATTRACTION_NOT_FOUND',
      );
    }
    return item;
  }

  async create(dto: CreateAttractionDto): Promise<AttractionResponseDto> {
    // 1. Validar operador existente y activo
    const operator = await this.operatorRepo.findOne({
      where: { ope_id: dto.operator_id },
    });
    if (!operator) {
      throw CatalogException.notFound(
        `El operador con ID ${dto.operator_id} no existe`,
        'OPERATOR_NOT_FOUND',
      );
    }
    if (!operator.ope_activo) {
      throw CatalogException.badRequest(
        `El operador con ID ${dto.operator_id} está inactivo y no puede recibir nuevas atracciones`,
        'OPERATOR_INACTIVE',
      );
    }

    // 2. Resolver slug único
    const slug = dto.slug?.trim() || slugify(dto.name);
    const existingSlug = await this.attractionRepo.findOne({
      where: { atr_slug: slug, atr_eliminado_en: IsNull() },
    });
    if (existingSlug) {
      throw CatalogException.conflict(
        `Ya existe una atracción con el slug "${slug}"`,
        'ATTRACTION_SLUG_CONFLICT',
      );
    }

    // 3. Crear entidad en estado inicial BORRADOR obligatorio
    const attraction = this.attractionRepo.create({
      atr_nombre: dto.name.trim(),
      atr_slug: slug,
      atr_descripcion: dto.description.trim(),
      atr_descripcion_corta: dto.short_description?.trim() || null,
      atr_tipo: dto.type,
      atr_estado: 'BORRADOR', // REGLA: Creación inicial siempre en BORRADOR
      atr_latitud: dto.latitude.toFixed(6),
      atr_longitud: dto.longitude.toFixed(6),
      atr_direccion: dto.address?.trim() || null,
      atr_punto_encuentro: dto.meeting_point?.trim() || null,
      atr_duracion_horas: dto.duration_hours.toFixed(2),
      atr_moneda: dto.currency || 'USD',
      ciu_id: dto.city_id,
      ope_id: dto.operator_id,
      atr_cancelacion_gratuita: dto.free_cancellation ?? false,
      atr_horas_cancelacion: dto.cancellation_hours ?? 24,
      atr_destacada: dto.featured ?? false,
    });

    const saved = await this.attractionRepo.save(attraction);
    const full = await this.findById(saved.atr_id);
    return toAttractionResponseDto(full);
  }

  async update(
    idOrUuidOrSlug: string,
    dto: UpdateAttractionDto,
  ): Promise<AttractionResponseDto> {
    const attraction = await this.findById(idOrUuidOrSlug);

    if (
      dto.operator_id !== undefined &&
      dto.operator_id !== attraction.ope_id
    ) {
      const operator = await this.operatorRepo.findOne({
        where: { ope_id: dto.operator_id },
      });
      if (!operator) {
        throw CatalogException.notFound(
          `El operador con ID ${dto.operator_id} no existe`,
          'OPERATOR_NOT_FOUND',
        );
      }
      if (!operator.ope_activo) {
        throw CatalogException.badRequest(
          `El operador con ID ${dto.operator_id} está inactivo`,
          'OPERATOR_INACTIVE',
        );
      }
      attraction.ope_id = dto.operator_id;
    }

    if (dto.name !== undefined) {
      attraction.atr_nombre = dto.name.trim();
    }

    if (dto.slug !== undefined) {
      const slug = dto.slug.trim() || slugify(attraction.atr_nombre);
      const existingSlug = await this.attractionRepo.findOne({
        where: { atr_slug: slug, atr_eliminado_en: IsNull() },
      });
      if (existingSlug && existingSlug.atr_id !== attraction.atr_id) {
        throw CatalogException.conflict(
          `Ya existe otra atracción con el slug "${slug}"`,
          'ATTRACTION_SLUG_CONFLICT',
        );
      }
      attraction.atr_slug = slug;
    }

    if (dto.description !== undefined) {
      attraction.atr_descripcion = dto.description.trim();
    }
    if (dto.short_description !== undefined) {
      attraction.atr_descripcion_corta = dto.short_description?.trim() || null;
    }
    if (dto.type !== undefined) {
      attraction.atr_tipo = dto.type;
    }
    if (dto.latitude !== undefined) {
      attraction.atr_latitud = dto.latitude.toFixed(6);
    }
    if (dto.longitude !== undefined) {
      attraction.atr_longitud = dto.longitude.toFixed(6);
    }
    if (dto.address !== undefined) {
      attraction.atr_direccion = dto.address?.trim() || null;
    }
    if (dto.meeting_point !== undefined) {
      attraction.atr_punto_encuentro = dto.meeting_point?.trim() || null;
    }
    if (dto.duration_hours !== undefined) {
      attraction.atr_duracion_horas = dto.duration_hours.toFixed(2);
    }
    if (dto.currency !== undefined) {
      attraction.atr_moneda = dto.currency;
    }
    if (dto.city_id !== undefined) {
      attraction.ciu_id = dto.city_id;
    }
    if (dto.free_cancellation !== undefined) {
      attraction.atr_cancelacion_gratuita = dto.free_cancellation;
    }
    if (dto.cancellation_hours !== undefined) {
      attraction.atr_horas_cancelacion = dto.cancellation_hours;
    }
    if (dto.featured !== undefined) {
      attraction.atr_destacada = dto.featured;
    }

    await this.attractionRepo.save(attraction);
    const updated = await this.findById(attraction.atr_id);
    return toAttractionResponseDto(updated);
  }

  async updateStatus(
    idOrUuidOrSlug: string,
    status: string,
  ): Promise<AttractionResponseDto> {
    const attraction = await this.findById(idOrUuidOrSlug);
    const validStates = ['BORRADOR', 'PUBLICADA', 'INACTIVA'];
    const normalized = status.toUpperCase().trim();
    if (!validStates.includes(normalized)) {
      throw CatalogException.badRequest(
        `Estado inválido "${status}". Debe ser uno de: ${validStates.join(', ')}`,
        'INVALID_STATUS',
      );
    }

    attraction.atr_estado = normalized;
    await this.attractionRepo.save(attraction);

    const updated = await this.findById(attraction.atr_id);
    return toAttractionResponseDto(updated);
  }

  async softDelete(idOrUuidOrSlug: string): Promise<void> {
    const attraction = await this.findById(idOrUuidOrSlug);
    attraction.atr_eliminado_en = new Date();
    await this.attractionRepo.save(attraction);
  }

  // 3. Relaciones: Categorías, Idiomas e Inclusiones
  async syncCategories(
    attractionId: string,
    categoryIds: number[],
  ): Promise<AttractionCategorySummary[]> {
    const attraction = await this.findById(attractionId);
    const uniqueIds = [...new Set(categoryIds)];

    if (uniqueIds.length > 0) {
      const existingCategories = await this.categoryRepo.findBy({
        cat_id: In(uniqueIds),
      });
      if (existingCategories.length !== uniqueIds.length) {
        const foundIds = new Set(existingCategories.map((c) => c.cat_id));
        const missing = uniqueIds.filter((id) => !foundIds.has(id));
        throw CatalogException.notFound(
          `Las siguientes categorías no existen: ${missing.join(', ')}`,
          'CATEGORIES_NOT_FOUND',
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(AtraccionCategoriaEntity, {
        atr_id: attraction.atr_id,
      });

      if (uniqueIds.length > 0) {
        const rows = uniqueIds.map((cat_id) =>
          manager.create(AtraccionCategoriaEntity, {
            atr_id: attraction.atr_id,
            cat_id,
          }),
        );
        await manager.save(rows);
      }
    });

    const refreshed = await this.findById(attraction.atr_id);
    return toAttractionResponseDto(refreshed).categories ?? [];
  }

  async syncLanguages(
    attractionId: string,
    languageIds: number[],
  ): Promise<AttractionLanguageSummary[]> {
    const attraction = await this.findById(attractionId);
    const uniqueIds = [...new Set(languageIds)];

    if (uniqueIds.length > 0) {
      const existingLanguages = await this.languageRepo.findBy({
        idi_id: In(uniqueIds),
      });
      if (existingLanguages.length !== uniqueIds.length) {
        const foundIds = new Set(existingLanguages.map((i) => i.idi_id));
        const missing = uniqueIds.filter((id) => !foundIds.has(id));
        throw CatalogException.notFound(
          `Los siguientes idiomas no existen: ${missing.join(', ')}`,
          'LANGUAGES_NOT_FOUND',
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(AtraccionIdiomaEntity, {
        atr_id: attraction.atr_id,
      });

      if (uniqueIds.length > 0) {
        const rows = uniqueIds.map((idi_id) =>
          manager.create(AtraccionIdiomaEntity, {
            atr_id: attraction.atr_id,
            idi_id,
          }),
        );
        await manager.save(rows);
      }
    });

    const refreshed = await this.findById(attraction.atr_id);
    return toAttractionResponseDto(refreshed).languages ?? [];
  }

  async syncInclusions(
    attractionId: string,
    inclusionIds: number[],
  ): Promise<AttractionInclusionSummary[]> {
    const attraction = await this.findById(attractionId);
    const uniqueIds = [...new Set(inclusionIds)];

    if (uniqueIds.length > 0) {
      const existingInclusions = await this.inclusionRepo.findBy({
        inc_id: In(uniqueIds),
      });
      if (existingInclusions.length !== uniqueIds.length) {
        const foundIds = new Set(existingInclusions.map((i) => i.inc_id));
        const missing = uniqueIds.filter((id) => !foundIds.has(id));
        throw CatalogException.notFound(
          `Las siguientes inclusiones no existen: ${missing.join(', ')}`,
          'INCLUSIONS_NOT_FOUND',
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(AtraccionInclusionEntity, {
        atr_id: attraction.atr_id,
      });

      if (uniqueIds.length > 0) {
        const rows = uniqueIds.map((inc_id) =>
          manager.create(AtraccionInclusionEntity, {
            atr_id: attraction.atr_id,
            inc_id,
          }),
        );
        await manager.save(rows);
      }
    });

    const refreshed = await this.findById(attraction.atr_id);
    return toAttractionResponseDto(refreshed).inclusions ?? [];
  }

  // 4. Gestión de fotografías
  async addPhoto(
    attractionId: string,
    dto: CreatePhotoDto,
  ): Promise<PhotoResponseDto> {
    const attraction = await this.findById(attractionId);

    const photo = this.attractionPhotoRepo.create({
      atr_id: attraction.atr_id,
      fot_url: dto.url.trim(),
      fot_alt: dto.alt.trim(),
      fot_orden: dto.order ?? 0,
    });

    const saved = await this.attractionPhotoRepo.save(photo);
    return toPhotoResponseDto(saved);
  }

  async updatePhoto(
    attractionId: string,
    photoId: string,
    dto: UpdatePhotoDto,
  ): Promise<PhotoResponseDto> {
    const attraction = await this.findById(attractionId);

    const photo = await this.attractionPhotoRepo.findOne({
      where: { fot_id: photoId, atr_id: attraction.atr_id },
    });
    if (!photo) {
      throw CatalogException.notFound(
        `Fotografía con ID ${photoId} no encontrada en la atracción ${attractionId}`,
        'PHOTO_NOT_FOUND',
      );
    }

    if (dto.url !== undefined) photo.fot_url = dto.url.trim();
    if (dto.alt !== undefined) photo.fot_alt = dto.alt.trim();
    if (dto.order !== undefined) photo.fot_orden = dto.order;

    const saved = await this.attractionPhotoRepo.save(photo);
    return toPhotoResponseDto(saved);
  }

  async deletePhoto(attractionId: string, photoId: string): Promise<void> {
    const attraction = await this.findById(attractionId);

    const photo = await this.attractionPhotoRepo.findOne({
      where: { fot_id: photoId, atr_id: attraction.atr_id },
    });
    if (!photo) {
      throw CatalogException.notFound(
        `Fotografía con ID ${photoId} no encontrada en la atracción ${attractionId}`,
        'PHOTO_NOT_FOUND',
      );
    }

    await this.attractionPhotoRepo.delete({
      fot_id: photoId,
      atr_id: attraction.atr_id,
    });
  }
}
