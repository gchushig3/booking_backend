import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Repository } from 'typeorm';
import { LanguagesService } from '../../src/modules/languages/languages.service.js';
import { InclusionsService } from '../../src/modules/inclusions/inclusions.service.js';
import type { IdiomaEntity } from '../../src/database/entities/idioma.entity.js';
import type { AtraccionIdiomaEntity } from '../../src/database/entities/atraccion-idioma.entity.js';
import type { InclusionEntity } from '../../src/database/entities/inclusion.entity.js';
import type { AtraccionInclusionEntity } from '../../src/database/entities/atraccion-inclusion.entity.js';

class FakeLanguageRepo {
  items: IdiomaEntity[] = [];
  private nextId = 1;

  find(): Promise<IdiomaEntity[]> {
    return Promise.resolve([...this.items]);
  }

  findOne(opts: {
    where?: { idi_id?: number; idi_codigo?: string };
  }): Promise<IdiomaEntity | null> {
    const id = opts?.where?.idi_id;
    const code = opts?.where?.idi_codigo;
    const found =
      this.items.find(
        (i) =>
          (id !== undefined && i.idi_id === id) ||
          (code !== undefined && i.idi_codigo === code),
      ) ?? null;
    return Promise.resolve(found);
  }

  create(dto: Partial<IdiomaEntity>): IdiomaEntity {
    return {
      idi_id: dto.idi_id ?? 0,
      idi_codigo: dto.idi_codigo ?? '',
      idi_nombre: dto.idi_nombre ?? '',
      atracciones: [],
    };
  }

  save(ent: IdiomaEntity): Promise<IdiomaEntity> {
    if (!ent.idi_id) {
      ent.idi_id = this.nextId++;
    }
    const idx = this.items.findIndex((i) => i.idi_id === ent.idi_id);
    if (idx >= 0) {
      this.items[idx] = ent;
    } else {
      this.items.push(ent);
    }
    return Promise.resolve(ent);
  }

  delete(id: number): Promise<void> {
    this.items = this.items.filter((i) => i.idi_id !== id);
    return Promise.resolve();
  }
}

class FakeAttractionLanguageRepo {
  countValue = 0;
  count(): Promise<number> {
    return Promise.resolve(this.countValue);
  }
}

class FakeInclusionRepo {
  items: InclusionEntity[] = [];
  private nextId = 1;

  findOne(opts: {
    where?: { inc_id?: number; inc_tipo?: string; inc_nombre?: string };
  }): Promise<InclusionEntity | null> {
    const id = opts?.where?.inc_id;
    const type = opts?.where?.inc_tipo;
    const name = opts?.where?.inc_nombre;
    const found =
      this.items.find(
        (inc) =>
          (id !== undefined && inc.inc_id === id) ||
          (type !== undefined &&
            name !== undefined &&
            inc.inc_tipo === type &&
            inc.inc_nombre === name),
      ) ?? null;
    return Promise.resolve(found);
  }

  create(dto: Partial<InclusionEntity>): InclusionEntity {
    return {
      inc_id: dto.inc_id ?? 0,
      inc_tipo: dto.inc_tipo ?? 'INCLUYE',
      inc_nombre: dto.inc_nombre ?? '',
      inc_orden: dto.inc_orden ?? 0,
      atracciones: [],
    };
  }

  save(ent: InclusionEntity): Promise<InclusionEntity> {
    if (!ent.inc_id) {
      ent.inc_id = this.nextId++;
    }
    const idx = this.items.findIndex((i) => i.inc_id === ent.inc_id);
    if (idx >= 0) {
      this.items[idx] = ent;
    } else {
      this.items.push(ent);
    }
    return Promise.resolve(ent);
  }

  delete(id: number): Promise<void> {
    this.items = this.items.filter((i) => i.inc_id !== id);
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

class FakeAttractionInclusionRepo {
  countValue = 0;
  count(): Promise<number> {
    return Promise.resolve(this.countValue);
  }
}

describe('LanguagesService & InclusionsService', () => {
  describe('LanguagesService', () => {
    let service: LanguagesService;
    let languageRepo: FakeLanguageRepo;
    let attractionLanguageRepo: FakeAttractionLanguageRepo;

    beforeEach(() => {
      languageRepo = new FakeLanguageRepo();
      attractionLanguageRepo = new FakeAttractionLanguageRepo();
      service = new LanguagesService(
        languageRepo as unknown as Repository<IdiomaEntity>,
        attractionLanguageRepo as unknown as Repository<AtraccionIdiomaEntity>,
      );
    });

    it('crea un nuevo idioma normalizando el código a minúsculas', async () => {
      const result = await service.create({
        code: 'IT',
        name: 'Italiano',
      });

      expect(result.code).toBe('it');
      expect(result.name).toBe('Italiano');
    });

    it('rechaza un código de idioma duplicado', async () => {
      await service.create({ code: 'es', name: 'Español' });

      await expect(
        service.create({ code: 'es', name: 'Español duplicado' }),
      ).rejects.toThrow('Ya existe un idioma con el código "es"');
    });

    it('impide eliminar un idioma si está asociado a atracciones', async () => {
      const created = await service.create({ code: 'fr', name: 'Francés' });
      attractionLanguageRepo.countValue = 4;

      await expect(service.delete(created.id)).rejects.toThrow(
        'asociado a una o más atracciones',
      );
    });
  });

  describe('InclusionsService', () => {
    let service: InclusionsService;
    let inclusionRepo: FakeInclusionRepo;
    let attractionInclusionRepo: FakeAttractionInclusionRepo;

    beforeEach(() => {
      inclusionRepo = new FakeInclusionRepo();
      attractionInclusionRepo = new FakeAttractionInclusionRepo();
      service = new InclusionsService(
        inclusionRepo as unknown as Repository<InclusionEntity>,
        attractionInclusionRepo as unknown as Repository<AtraccionInclusionEntity>,
      );
    });

    it('crea una nueva inclusión validando tipo', async () => {
      const result = await service.create({
        type: 'INCLUYE',
        name: 'Almuerzo típico',
        order: 1,
      });

      expect(result.type).toBe('INCLUYE');
      expect(result.name).toBe('Almuerzo típico');
    });

    it('rechaza par duplicado (inc_tipo, inc_nombre)', async () => {
      await service.create({ type: 'INCLUYE', name: 'Almuerzo' });

      await expect(
        service.create({ type: 'INCLUYE', name: 'Almuerzo' }),
      ).rejects.toThrow('Ya existe una inclusión de tipo "INCLUYE"');
    });
  });
});
