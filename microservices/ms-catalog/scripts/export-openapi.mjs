import 'reflect-metadata';
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { format } from 'prettier';
import { configureApplication } from '../dist/configure-application.js';
import { configureOpenApi } from '../dist/common/openapi/configure-openapi.js';
import { HealthController } from '../dist/health/health.controller.js';
import { BookingCatalogService } from '../dist/booking/booking-catalog.service.js';
import { CatalogEventsService } from '../dist/booking/catalog-events.service.js';

// Discover the real controllers without opening a database or invoking services.
const modules = [
  ['categories', 'Categories'],
  ['languages', 'Languages'],
  ['inclusions', 'Inclusions'],
  ['operators', 'Operators'],
  ['attractions', 'Attractions'],
];
const controllers = [HealthController];
const providers = [
  { provide: BookingCatalogService, useValue: {} },
  { provide: CatalogEventsService, useValue: {} },
];
for (const [folder, name] of modules) {
  const controller = await import(
    `../dist/modules/${folder}/${folder}.controller.js`
  );
  const service = await import(
    `../dist/modules/${folder}/${folder}.service.js`
  );
  controllers.push(controller[`${name}Controller`]);
  providers.push({ provide: service[`${name}Service`], useValue: {} });
}
const module = await Test.createTestingModule({
  controllers,
  providers,
}).compile();
const app = module.createNestApplication({ logger: false });
try {
  configureApplication(app);
  const document = configureOpenApi(app);
  await app.init();
  const response = await request(app.getHttpServer())
    .get('/api/docs-yaml')
    .expect(200);
  const rows = [];
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      const operation = item[method];
      if (!operation) continue;
      rows.push(
        `| ${method.toUpperCase()} | \`${path}\` | ${operation.security?.length ? 'JWT / ADMIN' : 'Público'} | ${Object.keys(operation.responses).join(', ')} |`,
      );
    }
  }
  const matrix =
    '# Matriz HTTP actual de ms_catalog\n\n' +
    'Generada con `npm run openapi:export`. Administracion: JWT, sesion vigente y rol ADMIN via Identity.\n\n' +
    '| Método | Ruta | Acceso | Respuestas documentadas |\n| --- | --- | --- | --- |\n' +
    rows.join('\n') +
    '\n';
  for (const [file, content] of [
    ['openapi.yaml', response.text],
    ['endpoints.md', await format(matrix, { parser: 'markdown' })],
  ]) {
    const target = new URL(`../docs/${file}`, import.meta.url);
    if (process.argv.includes('--check')) {
      if ((await readFile(target, 'utf8')) !== content) {
        throw new Error(
          `docs/${file} está desactualizado. Ejecute npm run openapi:export.`,
        );
      }
    } else {
      await writeFile(target, content, 'utf8');
      process.stdout.write(`Exportado: ${fileURLToPath(target)}\n`);
    }
  }
  if (process.argv.includes('--check'))
    process.stdout.write('OpenAPI y matriz coinciden con Swagger servido.\n');
} finally {
  await app.close();
}
