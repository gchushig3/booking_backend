import { createHash } from 'node:crypto';
import type { DataSource } from 'typeorm';

export async function applyIdentitySchema(
  source: DataSource,
  sql: string,
): Promise<void> {
  if (
    createHash('sha256').update(sql).digest('hex') !==
    '84fa0e694dece975a098b4d22b725b589fb94fe0f071d8f4872740a2ddedb204'
  )
    throw new Error('SQL does not match the approved Identity block');
  const runner = source.createQueryRunner();
  await runner.connect();
  try {
    await runner.startTransaction();
    await runner.query(
      "SELECT pg_advisory_xact_lock(hashtext('ms-identity:initial-schema'))",
    );
    const [target] = await runner.manager.query<
      Array<{ database: string; version: string }>
    >(
      "SELECT current_database() AS database, current_setting('server_version_num') AS version",
    );
    if (
      !target ||
      !['ms_identity', 'ms_identity_test'].includes(target.database)
    ) {
      throw new Error('Inicialización permitida únicamente en bases Identity');
    }
    if (Number(target.version) < 160000 || Number(target.version) >= 170000) {
      throw new Error('Inicialización requiere PostgreSQL 16');
    }
    const [existing] = await runner.manager.query<Array<{ count: number }>>(`
      SELECT count(*)::int AS count FROM (
        SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')
        UNION ALL
        SELECT t.oid FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE n.nspname='public' AND t.typtype='d'
        UNION ALL
        SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND NOT EXISTS (
          SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass
          AND d.objid=p.oid AND d.deptype='e'
        )
      ) AS objects
    `);
    if (!existing || existing.count !== 0) {
      throw new Error(
        'La base ya contiene objetos: no se recrea ni modifica el esquema existente',
      );
    }
    await runner.query(sql);
    await runner.commitTransaction();
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
}
