import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Repository } from 'typeorm';
import { CategoriesService } from '../../src/modules/categories/categories.service.js';
import type { CategoriaEntity } from '../../src/database/entities/categoria.entity.js';
import type { AtraccionCategoriaEntity } from '../../src/database/entities/atraccion-categoria.entity.js';
import { CatalogException } from '../../src/common/exceptions/catalog.exception.js';

class FakeCategoryRepo {
  items: CategoriaEntity[] = [];
  private nextId = 1;

  find(): Promise<CategoriaEntity[]> {
    return Promise.resolve([...this.items]);
  }

  findOne(opts: {
    where?: { cat_id?: number; cat_slug?: string };
    select?: string[];
  }): Promise<CategoriaEntity | null> {
    const id = opts?.where?.cat_id;
    const slug = opts?.where?.cat_slug;
    const found =
      this.items.find(
        (c) =>
          (id !== undefined && c.cat_id === id) ||
          (slug !== undefined && c.cat_slug === slug),
      ) ?? null;
    return Promise.resolve(found);
  }

  create(dto: Partial<CategoriaEntity>): CategoriaEntity {
    return {
      cat_id: dto.cat_id ?? 0,
      cat_padre_id: dto.cat_padre_id ?? null,
      cat_nombre: dto.cat_nombre ?? '',
      cat_slug: dto.cat_slug ?? '',
      cat_descripcion: dto.cat_descripcion ?? null,
      cat_icono: dto.cat_icono ?? 'map-pin',
      cat_orden: dto.cat_orden ?? 0,
      cat_activa: dto.cat_activa ?? true,
      padre: null,
      hijas: [],
      atracciones: [],
    };
  }

  save(ent: CategoriaEntity): Promise<CategoriaEntity> {
    if (!ent.cat_id) {
      ent.cat_id = this.nextId++;
    }
    const idx = this.items.findIndex((c) => c.cat_id === ent.cat_id);
    if (idx >= 0) {
      this.items[idx] = ent;
    } else {
      this.items.push(ent);
    }
    return Promise.resolve(ent);
  }

  count(opts: { where?: { cat_padre_id?: number } }): Promise<number> {
    const parentId = opts?.where?.cat_padre_id;
    return Promise.resolve(
      this.items.filter((c) => c.cat_padre_id === parentId).length,
    );
  }

  delete(id: number): Promise<void> {
    this.items = this.items.filter((c) => c.cat_id !== id);
    return Promise.resolve();
  }

  createQueryBuilder() {
    return {
      andWhere: () => this.createQueryBuilder(),
      orderBy: () => this.createQueryBuilder(),
      addOrderBy: () => this.createQueryBuilder(),
      getMany: () => Promise.resolve([...this.items]),
    };
  }
}

class FakeAttractionCategoryRepo {
  countValue = 0;
  count(): Promise<number> {
    return Promise.resolve(this.countValue);
  }
}

describe('CategoriesService', () => {
  let service: CategoriesService;
  let categoryRepo: FakeCategoryRepo;
  let attractionCategoryRepo: FakeAttractionCategoryRepo;

  beforeEach(() => {
    categoryRepo = new FakeCategoryRepo();
    attractionCategoryRepo = new FakeAttractionCategoryRepo();
    service = new CategoriesService(
      categoryRepo as unknown as Repository<CategoriaEntity>,
      attractionCategoryRepo as unknown as Repository<AtraccionCategoriaEntity>,
    );
  });

  describe('create', () => {
    it('crea una categoría con slug generado si no se especifica', async () => {
      const result = await service.create({
        name: 'Tours de Café',
      });

      expect(result.name).toBe('Tours de Café');
      expect(result.slug).toBe('tours-de-cafe');
      expect(result.active).toBe(true);
    });

    it('rechaza la creación si el slug ya existe', async () => {
      await service.create({
        name: 'Aventura',
        slug: 'aventura',
      });

      await expect(
        service.create({
          name: 'Aventura Dos',
          slug: 'aventura',
        }),
      ).rejects.toThrow(CatalogException);
    });
  });

  describe('update & cycle detection', () => {
    it('rechaza que una categoría sea su propio padre', async () => {
      const created = await service.create({ name: 'Playas', slug: 'playas' });

      await expect(
        service.update(created.id, { parent_id: created.id }),
      ).rejects.toThrow('Una categoría no puede ser su propio padre');
    });

    it('detecta ciclos indirectos (A -> B -> C -> A) y los rechaza', async () => {
      // 1 (raíz) -> 2 (hijo de 1) -> 3 (hijo de 2)
      const cat1 = await service.create({ name: 'Cat 1', slug: 'cat-1' });
      const cat2 = await service.create({
        name: 'Cat 2',
        slug: 'cat-2',
        parent_id: cat1.id,
      });
      const cat3 = await service.create({
        name: 'Cat 3',
        slug: 'cat-3',
        parent_id: cat2.id,
      });

      // Intentamos hacer que cat1 tenga como padre a cat3
      await expect(
        service.update(cat1.id, { parent_id: cat3.id }),
      ).rejects.toThrow(
        'No se permite crear ciclos indirectos en la jerarquía de categorías',
      );
    });

    it('permite cambiar a un padre válido sin ciclos', async () => {
      const cat1 = await service.create({ name: 'Cat 1', slug: 'cat-1' });
      const cat2 = await service.create({ name: 'Cat 2', slug: 'cat-2' });
      const cat3 = await service.create({
        name: 'Cat 3',
        slug: 'cat-3',
        parent_id: cat1.id,
      });

      const updated = await service.update(cat3.id, { parent_id: cat2.id });
      expect(updated.parent_id).toBe(cat2.id);
    });
  });

  describe('findTree', () => {
    it('construye el árbol recursivo a partir de las raíces', async () => {
      const cat1 = await service.create({
        name: 'Naturaleza',
        slug: 'naturaleza',
        order: 1,
      });
      const cat2 = await service.create({
        name: 'Montaña',
        slug: 'montana',
        parent_id: cat1.id,
        order: 1,
      });
      await service.create({
        name: 'Senderismo',
        slug: 'senderismo',
        parent_id: cat2.id,
        order: 1,
      });

      const tree = await service.findTree(true);

      expect(tree).toHaveLength(1);
      expect(tree[0]?.name).toBe('Naturaleza');
      expect(tree[0]?.children).toHaveLength(1);
      expect(tree[0]?.children[0]?.name).toBe('Montaña');
      expect(tree[0]?.children[0]?.children).toHaveLength(1);
      expect(tree[0]?.children[0]?.children[0]?.name).toBe('Senderismo');
    });
  });

  describe('delete', () => {
    it('impide eliminar una categoría con subcategorías', async () => {
      const cat1 = await service.create({ name: 'Cat 1', slug: 'cat-1' });
      await service.create({
        name: 'Cat 2',
        slug: 'cat-2',
        parent_id: cat1.id,
      });

      await expect(service.delete(cat1.id)).rejects.toThrow(
        'No se puede eliminar la categoría porque tiene subcategorías asociadas',
      );
    });

    it('impide eliminar una categoría asociada a atracciones', async () => {
      const cat1 = await service.create({ name: 'Cat 1', slug: 'cat-1' });
      attractionCategoryRepo.countValue = 3;

      await expect(service.delete(cat1.id)).rejects.toThrow(
        'No se puede eliminar la categoría porque está asociada a una o más atracciones',
      );
    });
  });
});
