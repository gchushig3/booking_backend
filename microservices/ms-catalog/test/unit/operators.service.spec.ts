import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Repository } from 'typeorm';
import { OperatorsService } from '../../src/modules/operators/operators.service.js';
import type { OperadorEntity } from '../../src/database/entities/operador.entity.js';
import type { OperadorUsuarioEntity } from '../../src/database/entities/operador-usuario.entity.js';
import type { AtraccionEntity } from '../../src/database/entities/atraccion.entity.js';

class FakeOperatorRepo {
  items: OperadorEntity[] = [];
  private nextId = 1;

  findOne(opts: {
    where?: { ope_id?: string; ope_codigo?: number; ope_ruc?: string };
  }): Promise<OperadorEntity | null> {
    const id = opts?.where?.ope_id;
    const code = opts?.where?.ope_codigo;
    const ruc = opts?.where?.ope_ruc;
    const found =
      this.items.find(
        (o) =>
          (id !== undefined && o.ope_id === id) ||
          (code !== undefined && o.ope_codigo === code) ||
          (ruc !== undefined && o.ope_ruc === ruc),
      ) ?? null;
    return Promise.resolve(found);
  }

  create(dto: Partial<OperadorEntity>): OperadorEntity {
    return {
      ope_id: dto.ope_id ?? String(this.nextId++),
      ope_codigo: dto.ope_codigo ?? 0,
      ope_nombre: dto.ope_nombre ?? '',
      ope_ruc: dto.ope_ruc ?? null,
      ope_correo: dto.ope_correo ?? null,
      ope_telefono: dto.ope_telefono ?? null,
      ope_direccion: dto.ope_direccion ?? null,
      prov_id: dto.prov_id ?? 1,
      ope_activo: dto.ope_activo ?? true,
      ope_creado_en: new Date(),
      ope_actualizado_en: new Date(),
      usuarios: [],
      atracciones: [],
    };
  }

  save(ent: OperadorEntity): Promise<OperadorEntity> {
    const idx = this.items.findIndex((o) => o.ope_id === ent.ope_id);
    if (idx >= 0) {
      this.items[idx] = ent;
    } else {
      this.items.push(ent);
    }
    return Promise.resolve(ent);
  }

  delete(id: string): Promise<void> {
    this.items = this.items.filter((o) => o.ope_id !== id);
    return Promise.resolve();
  }

  createQueryBuilder() {
    let queriedIdOrCode: string | number | undefined;
    return {
      leftJoinAndSelect: () => this.createQueryBuilder(),
      where: (_sql: string, params?: { val?: string; codeVal?: number }) => {
        queriedIdOrCode = params?.val ?? params?.codeVal;
        return this.createQueryBuilder();
      },
      getOne: () => {
        const found =
          this.items.find(
            (o) =>
              o.ope_id === String(queriedIdOrCode) ||
              o.ope_codigo === Number(queriedIdOrCode),
          ) ?? null;
        return Promise.resolve(found);
      },
    };
  }
}

class FakeOperatorUserRepo {
  items: OperadorUsuarioEntity[] = [];

  findOne(opts: {
    where?: { ope_id?: string; usu_id?: string };
  }): Promise<OperadorUsuarioEntity | null> {
    const opeId = opts?.where?.ope_id;
    const usuId = opts?.where?.usu_id;
    const found =
      this.items.find((u) => u.ope_id === opeId && u.usu_id === usuId) ?? null;
    return Promise.resolve(found);
  }

  create(dto: Partial<OperadorUsuarioEntity>): OperadorUsuarioEntity {
    return {
      ope_id: dto.ope_id ?? '',
      usu_id: dto.usu_id ?? '',
      opeu_cargo: dto.opeu_cargo ?? 'ADMIN',
      opeu_activo: dto.opeu_activo ?? true,
      operador: null as unknown as OperadorEntity,
    };
  }

  save(ent: OperadorUsuarioEntity): Promise<OperadorUsuarioEntity> {
    const idx = this.items.findIndex(
      (u) => u.ope_id === ent.ope_id && u.usu_id === ent.usu_id,
    );
    if (idx >= 0) {
      this.items[idx] = ent;
    } else {
      this.items.push(ent);
    }
    return Promise.resolve(ent);
  }

  delete(where: { ope_id: string; usu_id: string }): Promise<void> {
    this.items = this.items.filter(
      (u) => !(u.ope_id === where.ope_id && u.usu_id === where.usu_id),
    );
    return Promise.resolve();
  }
}

class FakeAttractionRepo {
  countValue = 0;
  count(): Promise<number> {
    return Promise.resolve(this.countValue);
  }
}

describe('OperatorsService', () => {
  let service: OperatorsService;
  let operatorRepo: FakeOperatorRepo;
  let operatorUserRepo: FakeOperatorUserRepo;
  let attractionRepo: FakeAttractionRepo;

  beforeEach(() => {
    operatorRepo = new FakeOperatorRepo();
    operatorUserRepo = new FakeOperatorUserRepo();
    attractionRepo = new FakeAttractionRepo();

    service = new OperatorsService(
      operatorRepo as unknown as Repository<OperadorEntity>,
      operatorUserRepo as unknown as Repository<OperadorUsuarioEntity>,
      attractionRepo as unknown as Repository<AtraccionEntity>,
    );
  });

  describe('create', () => {
    it('crea un operador con datos válidos', async () => {
      const result = await service.create({
        code: 101,
        name: 'Galapagos Expeditions',
        ruc: '1790011223001',
        email: 'info@galapagos.com',
        phone: '+593991234567',
        province_id: 20,
      });

      expect(result.code).toBe(101);
      expect(result.name).toBe('Galapagos Expeditions');
      expect(result.ruc).toBe('1790011223001');
    });

    it('falla si el código ya existe', async () => {
      await service.create({
        code: 101,
        name: 'Galapagos Expeditions',
        province_id: 20,
      });

      await expect(
        service.create({
          code: 101,
          name: 'Otro Operador',
          province_id: 1,
        }),
      ).rejects.toThrow('Ya existe un operador con el código 101');
    });
  });

  describe('operator users', () => {
    it('asocia un usuario al operador con rol válido', async () => {
      const op = await service.create({
        code: 105,
        name: 'Quito Tours',
        province_id: 17,
      });

      const result = await service.associateUser(op.id, {
        user_id: '42',
        role: 'ADMIN',
      });

      expect(result.operator_id).toBe(op.id);
      expect(result.user_id).toBe('42');
      expect(result.role).toBe('ADMIN');
      expect(result.active).toBe(true);
    });

    it('rechaza asociar un usuario que ya está vinculado', async () => {
      const op = await service.create({
        code: 106,
        name: 'Cuenca Tours',
        province_id: 1,
      });

      await service.associateUser(op.id, { user_id: '42', role: 'ADMIN' });

      await expect(
        service.associateUser(op.id, { user_id: '42', role: 'GUIA' }),
      ).rejects.toThrow('ya está asociado');
    });
  });
});
