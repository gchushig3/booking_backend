import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import type { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { validateEnvironment } from '../../src/config/environment.js';
import { databaseOptions } from '../../src/database/database-options.js';
import { createCatalogDataSource } from '../../src/database/catalog-domains.js';
import { applyCatalogSchema } from '../../src/database/apply-catalog-schema.js';
import {
  AtraccionEntity,
  AtraccionCompletaView,
  OperadorEntity,
  CategoriaEntity,
  IdiomaEntity,
  InclusionEntity,
  OperadorUsuarioEntity,
  AtraccionCategoriaEntity,
  AtraccionIdiomaEntity,
  AtraccionInclusionEntity,
  AtraccionFotoEntity,
} from '../../src/database/entities/index.js';

interface ExpectedColumn {
  name: string;
  type: string;
  nullable: boolean;
  identity: boolean;
  primary: boolean;
  default: string | null;
}
interface Manifest {
  tables: Record<string, { columns: ExpectedColumn[] }>;
}
interface ActualColumn {
  column_name: string;
  data_type: string;
  domain_name: string | null;
  is_nullable: string;
  identity_generation: string | null;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

const env = validateEnvironment(process.env);
if (
  env.NODE_ENV !== 'test' ||
  env.DB_DATABASE !== 'ms_catalog_test' ||
  !['127.0.0.1', 'localhost'].includes(env.DB_HOST) ||
  env.DB_PORT !== 5445
) {
  throw new Error(
    'Integración requiere ms_catalog_test en loopback:5445 y NODE_ENV=test',
  );
}

const source: DataSource = createCatalogDataSource(databaseOptions(env));
let runner: QueryRunner;
let manager: EntityManager;
let operator: OperadorEntity;
let attraction: AtraccionEntity;
let sql: string;
let manifest: Manifest;

const baseAttraction = (operatorId: string, slug = 'catalog-it-fixture') => ({
  ope_id: operatorId,
  ciu_id: 32767,
  atr_nombre: 'Recorrido Catalog de integración',
  atr_slug: slug,
  atr_descripcion: 'Naturaleza y patrimonio del Ecuador',
  atr_tipo: 'GUIDED_TOUR',
  atr_latitud: '-0.178652',
  atr_longitud: '-78.483120',
  atr_duracion_horas: '7.25',
});

async function expectSqlState(
  action: () => Promise<unknown>,
  code: string,
): Promise<void> {
  await runner.query('SAVEPOINT expected_failure');
  try {
    await expect(action()).rejects.toMatchObject({ driverError: { code } });
  } finally {
    await runner.query('ROLLBACK TO SAVEPOINT expected_failure');
    await runner.query('RELEASE SAVEPOINT expected_failure');
  }
}

async function linkCatalog(): Promise<void> {
  const category = await manager.findOneByOrFail(CategoriaEntity, {
    cat_slug: 'aventura',
  });
  const language = await manager.findOneByOrFail(IdiomaEntity, {
    idi_codigo: 'es',
  });
  const inclusion = await manager.save(InclusionEntity, {
    inc_tipo: 'INCLUYE',
    inc_nombre: 'Fixture de prueba',
  });
  await manager.insert(AtraccionCategoriaEntity, {
    atr_id: attraction.atr_id,
    cat_id: category.cat_id,
  });
  await manager.insert(AtraccionIdiomaEntity, {
    atr_id: attraction.atr_id,
    idi_id: language.idi_id,
  });
  await manager.insert(AtraccionInclusionEntity, {
    atr_id: attraction.atr_id,
    inc_id: inclusion.inc_id,
  });
  await manager.save(AtraccionFotoEntity, {
    atr_id: attraction.atr_id,
    fot_url: 'https://example.org/catalog-fixture.jpg',
    fot_alt: 'Paisaje de prueba',
    fot_orden: 2,
  });
}

describe('Persistencia Catalog en PostgreSQL 16 real', () => {
  beforeAll(async () => {
    sql = await readFile(
      new URL('../../database/migrations/001-catalog.sql', import.meta.url),
      'utf8',
    );
    manifest = JSON.parse(
      await readFile(
        new URL('../../database/schema-manifest.json', import.meta.url),
        'utf8',
      ),
    ) as Manifest;
    await source.initialize();
    const [target] = await source.query<
      Array<{ database: string; version: string }>
    >(
      "SELECT current_database() AS database, current_setting('server_version_num') AS version",
    );
    expect(target?.database).toBe('ms_catalog_test');
    expect(Number(target?.version)).toBeGreaterThanOrEqual(160000);
    expect(Number(target?.version)).toBeLessThan(170000);
    const tables = await source.query<Array<{ tablename: string }>>(
      "SELECT tablename FROM pg_tables WHERE schemaname='public'",
    );
    if (tables.length === 0) await applyCatalogSchema(source, sql);
  });

  beforeEach(async () => {
    runner = source.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    manager = runner.manager;
    operator = await manager.save(OperadorEntity, {
      ope_codigo: 100000,
      ope_nombre: 'Operador fixture',
      prov_id: 32767,
      ope_ruc: '1792348123001',
      ope_correo: 'fixture@example.org',
      ope_telefono: '+593991234567',
    });
    attraction = await manager.save(
      AtraccionEntity,
      baseAttraction(operator.ope_id),
    );
  });

  afterEach(async () => {
    if (runner?.isTransactionActive) await runner.rollbackTransaction();
    if (runner && !runner.isReleased) await runner.release();
  });

  afterAll(async () => {
    if (!source.isInitialized) return;
    try {
      for (const entity of [
        OperadorEntity,
        AtraccionEntity,
        InclusionEntity,
        AtraccionFotoEntity,
        OperadorUsuarioEntity,
        AtraccionCategoriaEntity,
        AtraccionIdiomaEntity,
        AtraccionInclusionEntity,
      ]) {
        expect(
          await source.getRepository(entity).count({ withDeleted: true }),
        ).toBe(0);
      }
      expect(await source.getRepository(CategoriaEntity).count()).toBe(6);
      expect(await source.getRepository(IdiomaEntity).count()).toBe(4);
    } finally {
      await source.destroy();
    }
  });

  it('mantiene la huella exacta del bloque SQL aprobado', async () => {
    const provenance = JSON.parse(
      await readFile(
        new URL('../../database/source.json', import.meta.url),
        'utf8',
      ),
    ) as { sha256: string };
    expect(createHash('sha256').update(sql).digest('hex')).toBe(
      provenance.sha256,
    );
  });

  it('contiene exactamente diez tablas y ninguna tabla de historial ORM', async () => {
    const rows = await manager.query<Array<{ tablename: string }>>(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    );
    expect(rows.map((r) => r.tablename)).toEqual(
      Object.keys(manifest.tables).sort(),
    );
    expect(source.options).toMatchObject({
      synchronize: false,
      dropSchema: false,
      migrationsRun: false,
    });
  });

  it.each([
    'operador',
    'operador_usuario',
    'categoria',
    'idioma',
    'inclusion',
    'atraccion',
    'atraccion_categoria',
    'atraccion_idioma',
    'atraccion_inclusion',
    'atraccion_foto',
  ])(
    'preserva columnas, dominios, tipos, defaults y nulabilidad de %s',
    async (table) => {
      const expected = manifest.tables[table];
      if (!expected) throw new Error('Tabla no declarada');
      const rows = await manager.query<ActualColumn[]>(
        `SELECT column_name,data_type,domain_name,is_nullable,
        identity_generation,column_default,character_maximum_length,numeric_precision,numeric_scale
        FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
        [table],
      );
      expect(rows.map((r) => r.column_name)).toEqual(
        expected.columns.map((c) => c.name),
      );
      const metadata = source.getMetadata(table);
      expect(metadata.columns.map((c) => c.databaseName).sort()).toEqual(
        expected.columns.map((c) => c.name).sort(),
      );
      for (const column of expected.columns) {
        const actual = rows.find((r) => r.column_name === column.name);
        expect(actual).toBeDefined();
        expect(actual?.is_nullable).toBe(column.nullable ? 'YES' : 'NO');
        expect(
          metadata.findColumnWithDatabaseName(column.name)?.isNullable,
        ).toBe(column.nullable);
        if (column.identity) expect(actual?.identity_generation).toBe('ALWAYS');
        const domain = column.type.startsWith('dom_') ? column.type : null;
        expect(actual?.domain_name).toBe(domain);
        const types: Record<string, string> = {
          BIGINT: 'bigint',
          INTEGER: 'integer',
          SMALLINT: 'smallint',
          BOOLEAN: 'boolean',
          UUID: 'uuid',
          TEXT: 'text',
          TIMESTAMPTZ: 'timestamp with time zone',
        };
        if (domain)
          expect(metadata.findColumnWithDatabaseName(column.name)?.type).toBe(
            domain,
          );
        else if (column.type.startsWith('VARCHAR'))
          expect(actual?.data_type).toBe('character varying');
        else if (column.type.startsWith('CHAR'))
          expect(actual?.data_type).toBe('character');
        else if (column.type.startsWith('NUMERIC'))
          expect(actual?.data_type).toBe('numeric');
        else expect(actual?.data_type).toBe(types[column.type]);
        const length = column.type.match(/^(?:VARCHAR|CHAR)\((\d+)\)/);
        if (length)
          expect(actual?.character_maximum_length).toBe(Number(length[1]));
        const numeric = column.type.match(/^NUMERIC\((\d+),(\d+)\)/);
        if (numeric) {
          expect(actual?.numeric_precision).toBe(Number(numeric[1]));
          expect(actual?.numeric_scale).toBe(Number(numeric[2]));
        }
        if (column.default) {
          const normalized =
            column.default === 'TRUE'
              ? 'true'
              : column.default === 'FALSE'
                ? 'false'
                : column.default;
          expect(actual?.column_default).toContain(normalized);
        }
      }
    },
  );

  it('preserva los cuatro dominios, doce índices y el índice GIN trigram', async () => {
    const domains = await manager.query<Array<{ domain_name: string }>>(
      "SELECT domain_name FROM information_schema.domains WHERE domain_schema='public' ORDER BY domain_name",
    );
    expect(domains.map((r) => r.domain_name)).toEqual([
      'dom_correo',
      'dom_moneda',
      'dom_ruc',
      'dom_telefono',
    ]);
    const indexes = await manager.query<
      Array<{ indexname: string; indexdef: string }>
    >("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public'");
    const explicit = [...sql.matchAll(/CREATE INDEX (\w+)/g)]
      .map((m) => m[1])
      .sort();
    expect(
      indexes
        .filter((i) => i.indexname.startsWith('ix_'))
        .map((i) => i.indexname)
        .sort(),
    ).toEqual(explicit);
    expect(
      indexes.find((i) => i.indexname === 'ix_atraccion_busqueda')?.indexdef,
    ).toMatch(/USING gin.*gin_trgm_ops/);
  });

  it('mantiene CHECK, UNIQUE y FK declarados con sus nombres', async () => {
    const expected = [...sql.matchAll(/CONSTRAINT (\w+)/g)].map((m) => m[1]);
    const constraints = await manager.query<Array<{ conname: string }>>(
      "SELECT conname FROM pg_constraint WHERE connamespace='public'::regnamespace",
    );
    for (const name of expected)
      expect(constraints.map((c) => c.conname)).toContain(name);
    for (const metadata of source.entityMetadatas.filter(
      (m) => m.tableType !== 'view',
    )) {
      for (const check of metadata.checks)
        expect(constraints.map((c) => c.conname)).toContain(check.name);
      for (const unique of metadata.uniques)
        expect(constraints.map((c) => c.conname)).toContain(unique.name);
    }
  });

  it('no crea relaciones ORM ni FK hacia Identity o Location', async () => {
    const foreign = await manager.query<
      Array<{
        schema: string;
        target: string;
        update_action: string;
        delete_action: string;
      }>
    >(`
      SELECT n.nspname AS schema,c.relname AS target,k.confupdtype AS update_action,k.confdeltype AS delete_action
      FROM pg_constraint k JOIN pg_class c ON c.oid=k.confrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE k.contype='f' AND k.connamespace='public'::regnamespace`);
    expect(foreign).toHaveLength(10);
    for (const key of foreign) {
      expect(key.schema).toBe('public');
      expect(Object.keys(manifest.tables)).toContain(key.target);
      expect(key.update_action).toBe('c');
    }
    expect(
      source.getMetadata(OperadorEntity).findColumnWithPropertyName('prov_id')
        ?.relationMetadata,
    ).toBeUndefined();
    expect(
      source.getMetadata(AtraccionEntity).findColumnWithPropertyName('ciu_id')
        ?.relationMetadata,
    ).toBeUndefined();
    expect(
      source
        .getMetadata(OperadorUsuarioEntity)
        .findColumnWithPropertyName('usu_id')?.relationMetadata,
    ).toBeUndefined();
  });

  it('conserva los seeds originales sin generar operadores ni atracciones de ejemplo', async () => {
    expect(
      (await manager.find(IdiomaEntity, { order: { idi_id: 'ASC' } })).map(
        (i) => [i.idi_codigo, i.idi_nombre],
      ),
    ).toEqual([
      ['es', 'Espanol'],
      ['en', 'Ingles'],
      ['fr', 'Frances'],
      ['de', 'Aleman'],
    ]);
    expect(
      (
        await manager.find(CategoriaEntity, { order: { cat_orden: 'ASC' } })
      ).map((c) => c.cat_slug),
    ).toEqual([
      'aventura',
      'cultural',
      'naturales',
      'gastronomia',
      'playas',
      'montana',
    ]);
  });

  it('rechaza reaplicar el inicializador y no duplica seeds', async () => {
    await expect(applyCatalogSchema(source, sql)).rejects.toThrow(
      'ya contiene objetos',
    );
    expect(await manager.count(CategoriaEntity)).toBe(6);
    expect(await manager.count(IdiomaEntity)).toBe(4);
  });

  it('genera UUID, identity y defaults BORRADOR desde PostgreSQL', async () => {
    const found = await manager.findOneByOrFail(AtraccionEntity, {
      atr_id: attraction.atr_id,
    });
    expect(typeof found.atr_id).toBe('string');
    expect(found.atr_uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(found).toMatchObject({
      atr_estado: 'BORRADOR',
      atr_moneda: 'USD',
      atr_horas_cancelacion: 24,
      atr_calificacion_promedio: '0.00',
      atr_numero_resenas: 0,
      atr_cancelacion_gratuita: false,
      atr_destacada: false,
      atr_eliminado_en: null,
    });
    expect(found.atr_duracion_horas).toBe('7.25');
    expect(found.atr_latitud).toBe('-0.178652');
    expect(found.atr_creado_en).toBeInstanceOf(Date);
  });

  it('preserva BIGINT mayor que Number.MAX_SAFE_INTEGER al asociar usuario lógico', async () => {
    const subject = '9007199254740993';
    await manager.insert(OperadorUsuarioEntity, {
      ope_id: operator.ope_id,
      usu_id: subject,
      opeu_cargo: 'GUIA',
    });
    const found = await manager.findOneByOrFail(OperadorUsuarioEntity, {
      ope_id: operator.ope_id,
      usu_id: subject,
    });
    expect(found.usu_id).toBe(subject);
    expect(found.opeu_activo).toBe(true);
  });

  it('persiste y carga todas las relaciones de atracción y metadatos de foto', async () => {
    await linkCatalog();
    const found = await manager.findOneOrFail(AtraccionEntity, {
      where: { atr_id: attraction.atr_id },
      relations: {
        operador: true,
        categorias: { categoria: true },
        idiomas: { idioma: true },
        inclusiones: { inclusion: true },
        fotos: true,
      },
    });
    expect(found.operador.ope_id).toBe(operator.ope_id);
    expect(found.categorias[0]?.categoria.cat_slug).toBe('aventura');
    expect(found.idiomas[0]?.idioma.idi_codigo).toBe('es');
    expect(found.inclusiones[0]?.inclusion.inc_nombre).toBe(
      'Fixture de prueba',
    );
    expect(found.fotos[0]).toMatchObject({
      fot_alt: 'Paisaje de prueba',
      fot_orden: 2,
    });
  });

  it('lee la vista original sin ocultar borradores ni inventar datos geográficos', async () => {
    const row = await manager.findOneByOrFail(AtraccionCompletaView, {
      atr_id: attraction.atr_id,
    });
    expect(row).toMatchObject({
      atr_estado: 'BORRADOR',
      ciu_id: 32767,
      operador: 'Operador fixture',
      operador_ruc: '1792348123001',
    });
  });

  it('conserva enlaces al borrar lógicamente y permite lectura explícita withDeleted', async () => {
    await linkCatalog();
    await manager.softDelete(AtraccionEntity, attraction.atr_id);
    expect(
      await manager.findOneBy(AtraccionEntity, { atr_id: attraction.atr_id }),
    ).toBeNull();
    const deleted = await manager.findOneOrFail(AtraccionEntity, {
      where: { atr_id: attraction.atr_id },
      withDeleted: true,
    });
    expect(deleted.atr_eliminado_en).toBeInstanceOf(Date);
    expect(
      await manager.count(AtraccionCategoriaEntity, {
        where: { atr_id: attraction.atr_id },
      }),
    ).toBe(1);
    expect(
      await manager.count(AtraccionFotoEntity, {
        where: { atr_id: attraction.atr_id },
      }),
    ).toBe(1);
  });

  it('protege proyecciones Review frente a save ORM', async () => {
    attraction.atr_calificacion_promedio = '4.90';
    attraction.atr_numero_resenas = 200;
    attraction.atr_nombre = 'Nombre actualizado';
    await manager.save(AtraccionEntity, attraction);
    const found = await manager.findOneByOrFail(AtraccionEntity, {
      atr_id: attraction.atr_id,
    });
    expect(found.atr_calificacion_promedio).toBe('0.00');
    expect(found.atr_numero_resenas).toBe(0);
    expect(found.atr_nombre).toBe('Nombre actualizado');
  });

  it.each([
    ['atr_duracion_horas', '0'],
    ['atr_duracion_horas', '720.01'],
    ['atr_latitud', '90.000001'],
    ['atr_longitud', '-180.000001'],
    ['atr_calificacion_promedio', '5.01'],
    ['atr_horas_cancelacion', '-1'],
    ['atr_estado', 'INVALIDA'],
    ['atr_tipo', 'INVENTADO'],
    ['atr_moneda', 'usd'],
  ])('PostgreSQL rechaza %s=%s', async (column, value) => {
    await expectSqlState(
      () =>
        manager.query(`UPDATE atraccion SET ${column}=$1 WHERE atr_id=$2`, [
          value,
          attraction.atr_id,
        ]),
      '23514',
    );
  });

  it.each([
    ['ope_ruc', '123'],
    ['ope_correo', 'correo-invalido'],
    ['ope_telefono', 'abc'],
  ])('el dominio SQL rechaza %s inválido', async (column, value) => {
    await expectSqlState(
      () =>
        manager.query(`UPDATE operador SET ${column}=$1 WHERE ope_id=$2`, [
          value,
          operator.ope_id,
        ]),
      '23514',
    );
  });

  it('rechaza slug duplicado y no libera el slug mediante borrado lógico', async () => {
    await manager.softDelete(AtraccionEntity, attraction.atr_id);
    await expectSqlState(
      () => manager.save(AtraccionEntity, baseAttraction(operator.ope_id)),
      '23505',
    );
  });

  it('rechaza UUID duplicado', async () => {
    await expectSqlState(
      () =>
        manager.save(AtraccionEntity, {
          ...baseAttraction(operator.ope_id, 'otro-slug'),
          atr_uuid: attraction.atr_uuid,
        }),
      '23505',
    );
  });

  it.each(['ope_codigo', 'ope_ruc'])(
    'rechaza duplicado de operador por %s',
    async (column) => {
      await expectSqlState(
        () =>
          manager.save(OperadorEntity, {
            ope_codigo: 100001,
            ope_nombre: 'Otro fixture',
            prov_id: 32767,
            [column]:
              column === 'ope_codigo' ? operator.ope_codigo : operator.ope_ruc,
          }),
        '23505',
      );
    },
  );

  it('exige operador existente y rechaza foto sin texto alternativo', async () => {
    await expectSqlState(
      () =>
        manager.save(
          AtraccionEntity,
          baseAttraction('9223372036854775807', 'sin-operador'),
        ),
      '23503',
    );
    await expectSqlState(
      () =>
        manager.query(
          'INSERT INTO atraccion_foto (atr_id,fot_url) VALUES ($1,$2)',
          [attraction.atr_id, 'https://example.org/no-alt.jpg'],
        ),
      '23502',
    );
  });

  it('rechaza asociaciones compuestas duplicadas', async () => {
    await linkCatalog();
    const category = await manager.findOneByOrFail(CategoriaEntity, {
      cat_slug: 'aventura',
    });
    await expectSqlState(
      () =>
        manager.insert(AtraccionCategoriaEntity, {
          atr_id: attraction.atr_id,
          cat_id: category.cat_id,
        }),
      '23505',
    );
  });

  it('carga jerarquía y respeta RESTRICT de padre y CHECK de autoparentesco', async () => {
    const parent = await manager.save(CategoriaEntity, {
      cat_nombre: 'Padre fixture',
      cat_slug: 'padre-fixture',
    });
    const child = await manager.save(CategoriaEntity, {
      cat_nombre: 'Hija fixture',
      cat_slug: 'hija-fixture',
      cat_padre_id: parent.cat_id,
    });
    const loaded = await manager.findOneOrFail(CategoriaEntity, {
      where: { cat_id: parent.cat_id },
      relations: { hijas: true },
    });
    expect(loaded.hijas[0]?.cat_id).toBe(child.cat_id);
    await expectSqlState(
      () => manager.delete(CategoriaEntity, parent.cat_id),
      '23503',
    );
    await expectSqlState(
      () =>
        manager.update(CategoriaEntity, parent.cat_id, {
          cat_padre_id: parent.cat_id,
        }),
      '23514',
    );
  });

  it('respeta RESTRICT al borrar operador o idioma referenciado', async () => {
    await linkCatalog();
    await expectSqlState(
      () => manager.delete(OperadorEntity, operator.ope_id),
      '23503',
    );
    const language = await manager.findOneByOrFail(IdiomaEntity, {
      idi_codigo: 'es',
    });
    await expectSqlState(
      () => manager.delete(IdiomaEntity, language.idi_id),
      '23503',
    );
  });

  it('conserva el CASCADE SQL de categoría e inclusión hacia sus asociaciones', async () => {
    await linkCatalog();
    const category = await manager.findOneByOrFail(CategoriaEntity, {
      cat_slug: 'aventura',
    });
    const inclusion = await manager.findOneByOrFail(InclusionEntity, {
      inc_nombre: 'Fixture de prueba',
    });
    await manager.delete(CategoriaEntity, category.cat_id);
    await manager.delete(InclusionEntity, inclusion.inc_id);
    expect(await manager.count(AtraccionCategoriaEntity)).toBe(0);
    expect(await manager.count(AtraccionInclusionEntity)).toBe(0);
    expect(await manager.count(AtraccionEntity)).toBe(1);
  });

  it('conserva CASCADE físico de la atracción según SQL, sin exponer un endpoint físico', async () => {
    await linkCatalog();
    await manager.delete(AtraccionEntity, attraction.atr_id);
    for (const entity of [
      AtraccionCategoriaEntity,
      AtraccionIdiomaEntity,
      AtraccionInclusionEntity,
      AtraccionFotoEntity,
    ]) {
      expect(await manager.count(entity)).toBe(0);
    }
    expect(await manager.count(OperadorEntity)).toBe(1);
  });

  it('conserva CASCADE de usuarios al borrar un operador sin atracciones', async () => {
    const other = await manager.save(OperadorEntity, {
      ope_codigo: 100002,
      ope_nombre: 'Sin atracciones',
      prov_id: 32767,
    });
    await manager.insert(OperadorUsuarioEntity, {
      ope_id: other.ope_id,
      usu_id: '123',
      opeu_cargo: 'GUIA',
    });
    await manager.delete(OperadorEntity, other.ope_id);
    expect(
      await manager.count(OperadorUsuarioEntity, {
        where: { ope_id: other.ope_id },
      }),
    ).toBe(0);
  });

  it.each([
    ['operador', 'ope_id', 'ope_actualizado_en'],
    ['atraccion', 'atr_id', 'atr_actualizado_en'],
  ])(
    'el trigger de %s impone el timestamp de actualización',
    async (table, idColumn, timeColumn) => {
      const id = table === 'operador' ? operator.ope_id : attraction.atr_id;
      await manager.query(
        `UPDATE ${table} SET ${timeColumn}='2000-01-01T00:00:00Z' WHERE ${idColumn}=$1 RETURNING ${timeColumn} AS updated`,
        [id],
      );
      const rows = await manager.query<Array<{ updated: Date }>>(
        `SELECT ${timeColumn} AS updated FROM ${table} WHERE ${idColumn}=$1`,
        [id],
      );
      expect(rows[0]?.updated.getTime()).toBeGreaterThan(
        Date.parse('2000-01-01T00:00:00Z'),
      );
    },
  );

  it('busca por datos propios y pagina con orden estable', async () => {
    await manager.save(AtraccionEntity, [
      baseAttraction(operator.ope_id, 'catalog-fixture-2'),
      baseAttraction(operator.ope_id, 'catalog-fixture-3'),
    ]);
    const [rows, total] = await manager
      .getRepository(AtraccionEntity)
      .createQueryBuilder('a')
      .where("(a.atr_nombre || ' ' || a.atr_descripcion) ILIKE :text", {
        text: '%patrimonio%',
      })
      .andWhere('a.ciu_id = :city', { city: 32767 })
      .orderBy('a.atr_id', 'ASC')
      .skip(1)
      .take(1)
      .getManyAndCount();
    expect(total).toBe(3);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.atr_slug).toBe('catalog-fixture-2');
  });

  it('ordena fotos sin inventar unicidad sobre fot_orden', async () => {
    await manager.save(AtraccionFotoEntity, [
      {
        atr_id: attraction.atr_id,
        fot_url: 'https://example.org/2.jpg',
        fot_alt: 'Segunda',
        fot_orden: 2,
      },
      {
        atr_id: attraction.atr_id,
        fot_url: 'https://example.org/1.jpg',
        fot_alt: 'Primera',
        fot_orden: 1,
      },
      {
        atr_id: attraction.atr_id,
        fot_url: 'https://example.org/3.jpg',
        fot_alt: 'Tercera',
        fot_orden: 2,
      },
    ]);
    const photos = await manager.find(AtraccionFotoEntity, {
      where: { atr_id: attraction.atr_id },
      order: { fot_orden: 'ASC', fot_id: 'ASC' },
    });
    expect(photos.map((p) => p.fot_alt)).toEqual([
      'Primera',
      'Segunda',
      'Tercera',
    ]);
  });
});
