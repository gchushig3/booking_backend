import { beforeEach, describe, expect, it } from '@jest/globals';
import type { DataSource, Repository } from 'typeorm';
import { AttractionsService } from '../../src/modules/attractions/attractions.service.js';
import type { AtraccionEntity } from '../../src/database/entities/atraccion.entity.js';
import type { AtraccionCategoriaEntity } from '../../src/database/entities/atraccion-categoria.entity.js';
import type { AtraccionIdiomaEntity } from '../../src/database/entities/atraccion-idioma.entity.js';
import type { AtraccionInclusionEntity } from '../../src/database/entities/atraccion-inclusion.entity.js';
import type { AtraccionFotoEntity } from '../../src/database/entities/atraccion-foto.entity.js';
import type { OperadorEntity } from '../../src/database/entities/operador.entity.js';
import type { CategoriaEntity } from '../../src/database/entities/categoria.entity.js';
import type { IdiomaEntity } from '../../src/database/entities/idioma.entity.js';
import type { InclusionEntity } from '../../src/database/entities/inclusion.entity.js';
import { CatalogException } from '../../src/common/exceptions/catalog.exception.js';

class FakeAttractionRepo {
  items: AtraccionEntity[] = [];
  private nextId = 1;

  findOne(opts: {
    where?: { atr_id?: string; atr_slug?: string; atr_eliminado_en?: unknown };
  }): Promise<AtraccionEntity | null> {
    const id = opts?.where?.atr_id;
    const slug = opts?.where?.atr_slug;
    const found =
      this.items.find(
        (a) =>
          (id !== undefined && a.atr_id === id) ||
          (slug !== undefined && a.atr_slug === slug),
      ) ?? null;
    return Promise.resolve(found);
  }

  create(dto: Partial<AtraccionEntity>): AtraccionEntity {
    return {
      atr_id: dto.atr_id ?? String(this.nextId++),
      atr_uuid: dto.atr_uuid ?? '00000000-0000-0000-0000-000000000001',
      atr_nombre: dto.atr_nombre ?? '',
      atr_slug: dto.atr_slug ?? '',
      atr_descripcion: dto.atr_descripcion ?? '',
      atr_descripcion_corta: dto.atr_descripcion_corta ?? null,
      atr_tipo: dto.atr_tipo ?? 'GUIDED_TOUR',
      atr_estado: dto.atr_estado ?? 'BORRADOR',
      atr_latitud: dto.atr_latitud ?? '0.000000',
      atr_longitud: dto.atr_longitud ?? '0.000000',
      atr_direccion: dto.atr_direccion ?? null,
      atr_punto_encuentro: dto.atr_punto_encuentro ?? null,
      atr_duracion_horas: dto.atr_duracion_horas ?? '1.00',
      atr_moneda: dto.atr_moneda ?? 'USD',
      ciu_id: dto.ciu_id ?? 1,
      ope_id: dto.ope_id ?? '1',
      atr_cancelacion_gratuita: dto.atr_cancelacion_gratuita ?? false,
      atr_horas_cancelacion: dto.atr_horas_cancelacion ?? 24,
      atr_destacada: dto.atr_destacada ?? false,
      atr_calificacion_promedio: '0.00',
      atr_numero_resenas: 0,
      atr_creado_en: new Date(),
      atr_actualizado_en: new Date(),
      atr_eliminado_en: null,
      operador: null as unknown as OperadorEntity,
      categorias: [],
      idiomas: [],
      inclusiones: [],
      fotos: [],
    };
  }

  save(ent: AtraccionEntity): Promise<AtraccionEntity> {
    const idx = this.items.findIndex((a) => a.atr_id === ent.atr_id);
    if (idx >= 0) {
      this.items[idx] = ent;
    } else {
      this.items.push(ent);
    }
    return Promise.resolve(ent);
  }

  createQueryBuilder() {
    let queriedVal: string | undefined;
    let onlyPublished = false;
    let onlyNonDeleted = false;
    const items = this.items;

    const builder = {
      leftJoinAndSelect: () => builder,
      innerJoin: () => builder,
      where: (_sql: string, params?: { estado?: string }) => {
        if (params?.estado === 'PUBLICADA') onlyPublished = true;
        return builder;
      },
      andWhere: (
        sql: string,
        params?: {
          val?: string;
          idValue?: string;
          uuidVal?: string;
          cityId?: number;
        },
      ) => {
        if (sql.includes('atr_eliminado_en IS NULL')) onlyNonDeleted = true;
        if (params?.val) queriedVal = params.val;
        if (params?.idValue) queriedVal = params.idValue;
        return builder;
      },
      getOne: () => {
        const found =
          items.find((a) => {
            const matchesId =
              queriedVal === undefined ||
              a.atr_id === queriedVal ||
              a.atr_uuid === queriedVal ||
              a.atr_slug === queriedVal;
            const matchesPublished =
              !onlyPublished || a.atr_estado === 'PUBLICADA';
            const matchesNonDeleted =
              !onlyNonDeleted || a.atr_eliminado_en === null;
            return matchesId && matchesPublished && matchesNonDeleted;
          }) ?? null;
        return Promise.resolve(found);
      },
      getManyAndCount: () => {
        const filtered = items.filter((a) => {
          if (onlyPublished && a.atr_estado !== 'PUBLICADA') return false;
          if (onlyNonDeleted && a.atr_eliminado_en !== null) return false;
          return true;
        });
        return Promise.resolve([filtered, filtered.length] as [
          AtraccionEntity[],
          number,
        ]);
      },
      orderBy: () => builder,
      skip: () => builder,
      take: () => builder,
    };

    return builder;
  }
}

class FakeOperatorRepoForAttractions {
  items: OperadorEntity[] = [];

  findOne(opts: {
    where?: { ope_id?: string };
  }): Promise<OperadorEntity | null> {
    const id = opts?.where?.ope_id;
    const found = this.items.find((o) => o.ope_id === id) ?? null;
    return Promise.resolve(found);
  }
}

describe('AttractionsService', () => {
  let service: AttractionsService;
  let attractionRepo: FakeAttractionRepo;
  let operatorRepo: FakeOperatorRepoForAttractions;

  beforeEach(() => {
    attractionRepo = new FakeAttractionRepo();
    operatorRepo = new FakeOperatorRepoForAttractions();

    // Crear operador de prueba activo
    operatorRepo.items.push({
      ope_id: '1',
      ope_codigo: 100,
      ope_nombre: 'Andes Tours',
      ope_ruc: null,
      ope_correo: null,
      ope_telefono: null,
      ope_direccion: null,
      prov_id: 17,
      ope_activo: true,
      ope_creado_en: new Date(),
      ope_actualizado_en: new Date(),
      usuarios: [],
      atracciones: [],
    });

    service = new AttractionsService(
      attractionRepo as unknown as Repository<AtraccionEntity>,
      {} as unknown as Repository<AtraccionCategoriaEntity>,
      {} as unknown as Repository<AtraccionIdiomaEntity>,
      {} as unknown as Repository<AtraccionInclusionEntity>,
      {} as unknown as Repository<AtraccionFotoEntity>,
      operatorRepo as unknown as Repository<OperadorEntity>,
      {} as unknown as Repository<CategoriaEntity>,
      {} as unknown as Repository<IdiomaEntity>,
      {} as unknown as Repository<InclusionEntity>,
      {} as unknown as DataSource,
    );
  });

  describe('create', () => {
    it('crea una atracción siempre en estado BORRADOR y valida operador activo', async () => {
      const result = await service.create({
        name: 'Tour Cotopaxi',
        description: 'Recorrido por el parque nacional',
        type: 'DAY_TRIP',
        latitude: -0.683333,
        longitude: -78.433333,
        duration_hours: 8,
        city_id: 1,
        operator_id: '1',
      });

      expect(result.status).toBe('BORRADOR');
      expect(result.name).toBe('Tour Cotopaxi');
      expect(result.slug).toBe('tour-cotopaxi');
      expect(result.reviews_count).toBe(0);
      expect(result.average_rating).toBe(0);
    });

    it('falla si el operador no existe o está inactivo', async () => {
      operatorRepo.items[0]!.ope_activo = false;

      await expect(
        service.create({
          name: 'Tour Inactivo',
          description: 'Desc',
          type: 'DAY_TRIP',
          latitude: 0,
          longitude: 0,
          duration_hours: 2,
          city_id: 1,
          operator_id: '1',
        }),
      ).rejects.toThrow('está inactivo');
    });
  });

  describe('updateStatus', () => {
    it('permite cambiar a estados válidos: PUBLICADA', async () => {
      const created = await service.create({
        name: 'Tour Quilotoa',
        description: 'Laguna verde',
        type: 'DAY_TRIP',
        latitude: -0.85,
        longitude: -78.9,
        duration_hours: 10,
        city_id: 1,
        operator_id: '1',
      });

      const updated = await service.updateStatus(created.id, 'PUBLICADA');
      expect(updated.status).toBe('PUBLICADA');
    });

    it('rechaza estados no autorizados', async () => {
      const created = await service.create({
        name: 'Tour Mindo',
        description: 'Aves y cascadas',
        type: 'DAY_TRIP',
        latitude: -0.05,
        longitude: -78.77,
        duration_hours: 6,
        city_id: 1,
        operator_id: '1',
      });

      await expect(
        service.updateStatus(created.id, 'CANCELADA'),
      ).rejects.toThrow('Estado inválido "CANCELADA"');
    });
  });

  describe('softDelete', () => {
    it('asigna atr_eliminado_en como Date', async () => {
      const created = await service.create({
        name: 'Tour Baños',
        description: 'Cascadas',
        type: 'DAY_TRIP',
        latitude: -1.39,
        longitude: -78.42,
        duration_hours: 5,
        city_id: 2,
        operator_id: '1',
      });

      await service.softDelete(created.id);
      const raw = attractionRepo.items.find((a) => a.atr_id === created.id);
      expect(raw?.atr_eliminado_en).toBeInstanceOf(Date);
    });
  });

  describe('findPublicById', () => {
    it('retorna 404 si la atracción está en BORRADOR', async () => {
      const created = await service.create({
        name: 'Tour Privado',
        description: 'Solo borrador',
        type: 'GUIDED_TOUR',
        latitude: 0,
        longitude: 0,
        duration_hours: 2,
        city_id: 1,
        operator_id: '1',
      });

      await expect(service.findPublicById(created.id)).rejects.toThrow(
        CatalogException,
      );
    });
  });
});
