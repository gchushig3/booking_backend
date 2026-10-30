import { readFile, writeFile } from 'node:fs/promises';
import { parse, parseDocument } from 'yaml';
import { format, resolveConfig } from 'prettier';
import { fileURLToPath } from 'node:url';

const raw = await readFile(
  new URL('../../../contracts/atracciones-openapi-v3.yaml', import.meta.url),
  'utf8',
);
// El contrato contiene claves duplicadas fuera del catalogo (p.ej. DisponibilidadSlot).
// Validar estrictamente cada esquema consumido; no modificar el contrato oficial.
const document = parseDocument(raw, { uniqueKeys: false });
const contract = document.toJS();
function schemaSource(name) {
  const node = document.getIn(['components', 'schemas', name]);
  if (!node?.range) throw new Error(`Missing schema ${name}`);
  return parse(
    raw
      .slice(node.range[0], node.range[1])
      .split('\n')
      .map((line, index) => (index === 0 ? line : line.slice(6)))
      .join('\n'),
  );
}
const roots = [
  'SearchAtraccionesRequestV2',
  'SearchAtraccionesResponseV2',
  'AtraccionDetailResponseV2',
  'CategoryFlat',
  'CategoryTreeNode',
];
const definitions = {};
function convert(value) {
  if (Array.isArray(value)) return value.map(convert);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (
      ['nullable', 'example', 'xml', 'discriminator', 'deprecated'].includes(
        key,
      )
    )
      continue;
    if (key === '$ref') {
      const name = entry.split('/').pop();
      if (!(name in definitions)) {
        definitions[name] = {};
        definitions[name] = convert(schemaSource(name));
      }
      result[key] = `#/$defs/${name}`;
    } else result[key] = convert(entry);
  }
  if (value.nullable && result.type) result.type = [result.type, 'null'];
  return result;
}
for (const name of roots) {
  definitions[name] = convert(schemaSource(name));
}
const output =
  '// Generado desde contracts/atracciones-openapi-v3.yaml. No editar manualmente.\n' +
  `export const bookingDefinitions = ${JSON.stringify(definitions, null, 2)};\n` +
  `export const bookingListParameters = ${JSON.stringify(
    contract.paths['/atracciones'].get.parameters.filter(
      (p) => p.in === 'query',
    ),
    null,
    2,
  )};\n` +
  'export function bookingSchema(name: keyof typeof bookingDefinitions): object {\n' +
  '  return { $ref: `#/$defs/${name}`, $defs: bookingDefinitions };\n}\n';
const target = new URL('../src/booking/contract-schemas.ts', import.meta.url);
const formatted = await format(output, {
  ...(await resolveConfig(fileURLToPath(target))),
  parser: 'typescript',
});
if (process.argv.includes('--check')) {
  if ((await readFile(target, 'utf8')) !== formatted)
    throw new Error('Booking schemas are out of date');
} else await writeFile(target, formatted);
