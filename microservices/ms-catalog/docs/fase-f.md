# Fase F — Swagger y OpenAPI

Fecha: 2026-10-28, America/Guayaquil. Autorización explícita: «Sí vamos con el F».

## 1. Resumen

Se centralizó la generación de OpenAPI 3.0 en una configuración compartida por main.ts,
las pruebas HTTP y la exportación. Swagger documenta 38 operaciones existentes:
7 consultas públicas de negocio, 1 liveness y 30 operaciones protegidas.
La administración continúa bloqueada por el contrato pendiente de Identity.
No se inició Fase G ni se realizó despliegue.

## 2. Archivos creados y modificados

Nuevos:

- `src/common/openapi/configure-openapi.ts`: documento, errores, seguridad efectiva,
  encabezados, instalación de UI y endpoints JSON/YAML.
- `src/common/openapi/paginated-schema.ts`: esquema concreto de respuestas paginadas.
- `scripts/export-openapi.mjs`: exportación y verificación sin conectar a PostgreSQL.
- `docs/openapi.yaml`: contrato generado desde el YAML servido por Swagger.
- `docs/endpoints.md`: matriz generada de acceso y respuestas actuales.
- `docs/fase-f.md`: evidencia y límites de esta fase.

Modificados:

- `src/main.ts`: utiliza la configuración Swagger compartida.
- Los cinco controladores de `src/modules/*`: tipos explícitos de respuesta, arrays y paginación.
- Los DTOs de `src/modules/*/dto`: metadatos Swagger de tipos, campos obligatorios,
  nulabilidad, valores predeterminados, ejemplos y validaciones existentes.
  Las interfaces de respuesta pasan a clases con metadatos; sus mapeadores mantienen
  las mismas propiedades y valores. No se añadieron campos de persistencia.
- `src/common/pagination/pagination-query.dto.ts`: límites y defaults documentados.
- `src/health/health.controller.ts`: esquema y alcance de liveness.
- `test/e2e/api-v2.e2e-spec.ts`: comprobaciones HTTP y del contrato generado.
- `package.json`: scripts `openapi:export` y `openapi:check`.
- `README.md`: URLs, instrucciones, matriz vigente y bloqueo administrativo.

## 3. Decisiones técnicas

Se emplean decoradores explícitos en lugar de depender de un transformador que podría
producir resultados distintos entre compilación y ts-jest. Los bigint expuestos por
los mapeadores siguen siendo strings. Se conservan los tipos numéricos, campos nulos,
colecciones opcionales, árbol recursivo y proyecciones de Review de solo lectura.
Los DTOs de entrada siguen excluyendo las proyecciones.

Los ejemplos son ilustrativos, no son seeds ni datos obtenidos de PostgreSQL.
No se cambió la validación de negocio, las rutas, la seguridad de E ni el esquema SQL.
No se añadieron dependencias ni se modificó el contrato externo de Booking.

## 4. Contratos documentados

| Recurso                  | URL                 |
| ------------------------ | ------------------- |
| API interna              | `/api/v2`           |
| Swagger UI               | `/api/docs`         |
| OpenAPI JSON             | `/api/docs-json`    |
| OpenAPI YAML             | `/api/docs-yaml`    |
| Contrato local exportado | `docs/openapi.yaml` |
| Matriz HTTP vigente      | `docs/endpoints.md` |

Las consultas públicas documentan respuestas exitosas con esquemas concretos,
query/body/path parameters y errores aplicables. Las respuestas de error usan
`application/problem+json`; éxitos con cuerpo usan `application/json`.
`X-Correlation-Id` se documenta en solicitud y respuesta como texto, conforme al middleware:
se recorta y propaga, o se genera un UUID cuando falta o está vacío.

Las 30 operaciones protegidas documentan únicamente `401 AUTHENTICATION_UNAVAILABLE`
como respuesta operativa. Declaran Bearer reservado, `x-admin-blocked: true` y una
advertencia visible. Las respuestas de los servicios que no pueden alcanzarse actualmente
se conservan en `x-intended-responses`, fuera de `responses`.
Los esquemas de petición se mantienen como referencia del código existente; no habilitan
las operaciones. Swagger no conserva tokens en el almacenamiento del navegador.

No se anuncian 403, 409, 503 ni creación autorizada como comportamientos HTTP operativos
en rutas que el guard bloquea antes de invocar servicios. Estos casos siguen sujetos
a contratos y pruebas posteriores.

## 5. Comandos ejecutados

Desde `microservices/ms-catalog`, utilizando `npm.cmd` en PowerShell:

```sh
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run openapi:export
npm.cmd run openapi:check
npm.cmd test
npm.cmd run test:e2e
```

`openapi:export` y `openapi:check` ejecutan `nest build` primero.
También se ejecutó Prettier sobre los archivos de esta fase.
Para regenerar el contrato se necesita instalar las dependencias de desarrollo.

## 6. Resultados verificables

| Comprobación                                        | Resultado              |
| --------------------------------------------------- | ---------------------- |
| TypeScript (`tsc --noEmit`)                         | Aprobado               |
| ESLint (`--max-warnings=0`)                         | Aprobado               |
| Build (`nest build`)                                | Aprobado               |
| Pruebas unitarias                                   | 52 aprobadas, 7 suites |
| Pruebas e2e HTTP                                    | 57 aprobadas, 3 suites |
| UI, bundle e inicialización de Swagger por HTTP     | Aprobado               |
| JSON/YAML servidos y YAML versionado coinciden      | Aprobado               |
| Verificación de contrato y matriz (`openapi:check`) | Aprobado               |

Las pruebas comprueban prefijo `/api/v2`, IDs de operación únicos, parámetros de ruta
obligatorios, referencias resolubles, esquemas de entrada/salida, paginación,
proyecciones de solo lectura, campos obligatorios en respuestas públicas de prueba,
seguridad de todas las rutas administrativas, correlación, tipos de contenido y errores
400/401/404/500. La UI y sus recursos se solicitan por HTTP contra Nest real.
No se realizó una inspección visual en navegador ni una validación externa completa del
documento contra un metamodelo OpenAPI.

El montaje HTTP usa servicios de prueba; no verifica PostgreSQL ni la aplicación completa
con AppModule y base de datos. La exportación usa proveedores vacíos exclusivamente
para descubrir metadatos: no invoca operaciones de negocio ni genera datos simulados.

## 7. Errores corregidos durante la fase

- Esquemas de DTOs vacíos por falta de metadatos y respuestas declaradas como interfaces.
- Respuestas exitosas anunciadas para administración inaccesible por HTTP.
- Encabezado de correlación documentado como UUID aunque admite texto.
- Importación interna de tipos Swagger no exportada por el paquete instalado; sustituida
  por sus exports públicos.
- Acceso dinámico en prueba reformateado por Prettier, rechazado por ESLint;
  se usa una variable de cliente para conservar formato y lint válidos.

## 8. Riesgos y pendientes

- JWT, issuer/audience/claves, permisos y vínculo sujeto/usu_id siguen sin contrato aprobado.
- La validación preexistente de `role` admite ADMIN/VENDEDOR/GUIA, mientras SQL define
  `opeu_cargo` como texto. Se documenta el comportamiento existente sin atribuirle
  aprobación RBAC. Debe reconciliarse antes de habilitar administración.
- Persisten las integraciones pendientes de Location y Review, las transiciones formales
  de publicación y la verificación de propiedad por operador.
- La separación física en un repositorio independiente sigue pendiente de fases anteriores.
- No se ejecutaron PostgreSQL, pruebas de integración ni Docker en F; corresponden a G.
- Los documentos maestros no se modificaron. La inconsistencia previamente registrada
  de claves duplicadas en TimeSlotItem del OpenAPI externo continúa pendiente de su propietario.

## 9. Criterios de aceptación

Cumplidos para F: Swagger en `/api/docs`, API documentada bajo `/api/v2`, operaciones
existentes, parámetros, DTOs, validaciones, respuestas, errores, Bearer reservado,
correlación, contrato local reproducible y pruebas HTTP ejecutadas sin abrir administración.
La comprobación con PostgreSQL/Docker y la autenticación real no se declaran cumplidas.

## 10. Autorización siguiente

Detener al finalizar F. Solicitar autorización explícita para Fase G:
pruebas de integración y ejecución local con Docker, conservando el bloqueo administrativo
hasta disponer de contratos aprobados. No realizar despliegue.
