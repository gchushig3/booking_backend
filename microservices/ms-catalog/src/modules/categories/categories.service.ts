import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoriaEntity } from '../../database/entities/categoria.entity.js';
import { AtraccionCategoriaEntity } from '../../database/entities/atraccion-categoria.entity.js';
import { CatalogException } from '../../common/exceptions/catalog.exception.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';
import type { UpdateCategoryDto } from './dto/update-category.dto.js';
import type { FilterCategoriesQueryDto } from './dto/filter-categories-query.dto.js';
import {
  toCategoryResponseDto,
  type CategoryResponseDto,
  type CategoryTreeNodeDto,
} from './dto/category-response.dto.js';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(CategoriaEntity)
    private readonly categoryRepo: Repository<CategoriaEntity>,
    @InjectRepository(AtraccionCategoriaEntity)
    private readonly attractionCategoryRepo: Repository<AtraccionCategoriaEntity>,
  ) {}

  async findFlat(
    query?: FilterCategoriesQueryDto,
  ): Promise<CategoryResponseDto[]> {
    const qb = this.categoryRepo.createQueryBuilder('c');

    if (query?.active !== undefined) {
      qb.andWhere('c.cat_activa = :activa', { activa: query.active });
    }

    if (query?.parent_id !== undefined) {
      qb.andWhere('c.cat_padre_id = :padreId', { padreId: query.parent_id });
    }

    qb.orderBy('c.cat_orden', 'ASC').addOrderBy('c.cat_nombre', 'ASC');

    const categories = await qb.getMany();
    return categories.map(toCategoryResponseDto);
  }

  async findTree(activeOnly: boolean = true): Promise<CategoryTreeNodeDto[]> {
    const qb = this.categoryRepo.createQueryBuilder('c');
    if (activeOnly) {
      qb.andWhere('c.cat_activa = true');
    }
    qb.orderBy('c.cat_orden', 'ASC').addOrderBy('c.cat_nombre', 'ASC');

    const all = await qb.getMany();
    return this.buildTree(all, null);
  }

  private buildTree(
    categories: CategoriaEntity[],
    parentId: number | null,
  ): CategoryTreeNodeDto[] {
    return categories
      .filter((cat) => cat.cat_padre_id === parentId)
      .map((cat) => ({
        ...toCategoryResponseDto(cat),
        children: this.buildTree(categories, cat.cat_id),
      }));
  }

  async findById(id: number): Promise<CategoryResponseDto> {
    const category = await this.categoryRepo.findOne({
      where: { cat_id: id },
    });
    if (!category) {
      throw CatalogException.notFound(
        `Categoría con ID ${id} no encontrada`,
        'CATEGORY_NOT_FOUND',
      );
    }
    return toCategoryResponseDto(category);
  }

  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    if (dto.parent_id) {
      const parent = await this.categoryRepo.findOne({
        where: { cat_id: dto.parent_id },
      });
      if (!parent) {
        throw CatalogException.notFound(
          `La categoría padre con ID ${dto.parent_id} no existe`,
          'PARENT_CATEGORY_NOT_FOUND',
        );
      }
    }

    const slug = dto.slug?.trim() || slugify(dto.name);
    const existingSlug = await this.categoryRepo.findOne({
      where: { cat_slug: slug },
    });
    if (existingSlug) {
      throw CatalogException.conflict(
        `Ya existe una categoría con el slug "${slug}"`,
        'CATEGORY_SLUG_CONFLICT',
      );
    }

    const category = this.categoryRepo.create({
      cat_nombre: dto.name.trim(),
      cat_slug: slug,
      cat_descripcion: dto.description?.trim() || null,
      cat_icono: dto.icon || 'map-pin',
      cat_orden: dto.order ?? 0,
      cat_padre_id: dto.parent_id ?? null,
      cat_activa: dto.active ?? true,
    });

    const saved = await this.categoryRepo.save(category);
    return toCategoryResponseDto(saved);
  }

  async update(
    id: number,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.categoryRepo.findOne({
      where: { cat_id: id },
    });
    if (!category) {
      throw CatalogException.notFound(
        `Categoría con ID ${id} no encontrada`,
        'CATEGORY_NOT_FOUND',
      );
    }

    if (dto.parent_id !== undefined) {
      if (dto.parent_id !== null) {
        if (dto.parent_id === id) {
          throw CatalogException.badRequest(
            'Una categoría no puede ser su propio padre',
            'CATEGORY_SELF_PARENT',
          );
        }

        const parent = await this.categoryRepo.findOne({
          where: { cat_id: dto.parent_id },
        });
        if (!parent) {
          throw CatalogException.notFound(
            `La categoría padre con ID ${dto.parent_id} no existe`,
            'PARENT_CATEGORY_NOT_FOUND',
          );
        }

        const isCycle = await this.detectCycle(id, dto.parent_id);
        if (isCycle) {
          throw CatalogException.conflict(
            'No se permite crear ciclos indirectos en la jerarquía de categorías',
            'CATEGORY_CYCLE_DETECTED',
          );
        }
      }
      category.cat_padre_id = dto.parent_id;
    }

    if (dto.name !== undefined) {
      category.cat_nombre = dto.name.trim();
    }

    if (dto.slug !== undefined) {
      const slug = dto.slug.trim() || slugify(category.cat_nombre);
      const existingSlug = await this.categoryRepo.findOne({
        where: { cat_slug: slug },
      });
      if (existingSlug && existingSlug.cat_id !== id) {
        throw CatalogException.conflict(
          `Ya existe otra categoría con el slug "${slug}"`,
          'CATEGORY_SLUG_CONFLICT',
        );
      }
      category.cat_slug = slug;
    }

    if (dto.description !== undefined) {
      category.cat_descripcion = dto.description?.trim() || null;
    }

    if (dto.icon !== undefined) {
      category.cat_icono = dto.icon;
    }

    if (dto.order !== undefined) {
      category.cat_orden = dto.order;
    }

    if (dto.active !== undefined) {
      category.cat_activa = dto.active;
    }

    const saved = await this.categoryRepo.save(category);
    return toCategoryResponseDto(saved);
  }

  async delete(id: number): Promise<void> {
    const category = await this.categoryRepo.findOne({
      where: { cat_id: id },
    });
    if (!category) {
      throw CatalogException.notFound(
        `Categoría con ID ${id} no encontrada`,
        'CATEGORY_NOT_FOUND',
      );
    }

    const childCount = await this.categoryRepo.count({
      where: { cat_padre_id: id },
    });
    if (childCount > 0) {
      throw CatalogException.conflict(
        'No se puede eliminar la categoría porque tiene subcategorías asociadas',
        'CATEGORY_HAS_CHILDREN',
      );
    }

    const attractionCount = await this.attractionCategoryRepo.count({
      where: { cat_id: id },
    });
    if (attractionCount > 0) {
      throw CatalogException.conflict(
        'No se puede eliminar la categoría porque está asociada a una o más atracciones',
        'CATEGORY_HAS_ATTRACTIONS',
      );
    }

    await this.categoryRepo.delete(id);
  }

  private async detectCycle(
    categoryId: number,
    proposedParentId: number,
  ): Promise<boolean> {
    // Si proposedParentId desciende de categoryId, se formaría un ciclo.
    // Recorremos los ancestros de proposedParentId hacia arriba. Si encontramos categoryId, hay ciclo.
    let currentId: number | null = proposedParentId;
    const visited = new Set<number>();

    while (currentId !== null) {
      if (currentId === categoryId) {
        return true;
      }
      if (visited.has(currentId)) {
        // Ciclo preexistente
        return true;
      }
      visited.add(currentId);

      const parentNode: CategoriaEntity | null =
        await this.categoryRepo.findOne({
          where: { cat_id: currentId },
          select: ['cat_id', 'cat_padre_id'],
        });

      currentId = parentNode?.cat_padre_id ?? null;
    }

    return false;
  }
}
