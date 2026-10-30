import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { validateEnvironment } from '../dist/config/environment.js';
import { databaseOptions } from '../dist/database/database-options.js';
import { createCatalogDataSource } from '../dist/database/catalog-domains.js';
import { applyCatalogSchema } from '../dist/database/apply-catalog-schema.js';

const env = validateEnvironment(process.env);
if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
  throw new Error(
    'Este inicializador está autorizado solo para ejecución local y tests',
  );
}
const sql = await readFile(
  new URL('../database/migrations/001-catalog.sql', import.meta.url),
  'utf8',
);
const provenance = JSON.parse(
  await readFile(new URL('../database/source.json', import.meta.url), 'utf8'),
);
if (createHash('sha256').update(sql).digest('hex') !== provenance.sha256) {
  throw new Error('El SQL no coincide con la huella de la fuente aprobada');
}
const source = createCatalogDataSource(databaseOptions(env));
try {
  await source.initialize();
  await applyCatalogSchema(source, sql);
  console.log(
    'Esquema Catalog inicializado en transacción; seeds originales aplicados una vez.',
  );
} catch {
  console.error(
    'Inicialización rechazada o fallida. Compruebe destino, versión, permisos y que la base esté vacía. No se reintenta ni se borra el esquema.',
  );
  process.exitCode = 1;
} finally {
  if (source.isInitialized) await source.destroy();
}
