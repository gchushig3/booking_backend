# Fase D — Controladores, Servicios, DTOs y Swagger

Fecha: 2026-10-28, America/Guayaquil. Autorización explícita para Fase D recibida del usuario.
No se inicia Fase E.

## 1. Resumen

Se implementó la capa completa de controladores REST, servicios de negocio, DTOs de entrada/salida,
manejo de errores con Problem Details (RFC 7807), correlación de solicitudes (X-Correlation-Id) y
documentación Swagger/OpenAPI 3 para los cinco módulos del catálogo.

El microservicio ms-catalog ahora expone un API REST funcional bajo `/api/v2` con 35+ operaciones
cubriendo atracciones, categorías, idiomas, inclusiones y operadores.

Swagger UI disponible en `/api/docs`.

## 2. Archivos creados

### Infraestructura común

- `src/common/middleware/correlation-id.middleware.ts` — Middleware de X-Correlation-Id (propaga o genera UUID).
- `src/common/filters/problem-details.filter.ts` — Filtro global de excepciones que produce `application/problem+json`.
- `src/common/exceptions/catalog.exception.ts` — Excepción personalizada con fábricas estáticas (notFound, conflict, badRequest).
- `src/common/pagination/pagination-query.dto.ts` — DTO reutilizable de paginación (page, limit).
- `src/common/pagination/paginated-response.dto.ts` — Builder genérico PaginatedResponse<T>.
- `src/common/dto/dto-utils.ts` — Helpers @Transform tipados con tolerancia a campos en español (Ley de Postel).

### Módulo de Atracciones (`src/modules/attractions/`)

- `attractions.module.ts` — Módulo NestJS con TypeOrmModule.forFeature para 9 entidades.
- `attractions.controller.ts` — Controlador REST con decoradores Swagger.
- `attractions.service.ts` — Servicio con lógica de negocio completa.
- `dto/create-attraction.dto.ts` — DTO de creación.
- `dto/update-attraction.dto.ts` — DTO de actualización parcial.
- `dto/update-attraction-status.dto.ts` — DTO de cambio de estado.
- `dto/filter-attractions-query.dto.ts` — DTO de filtros de consulta pública.
- `dto/search-attractions.dto.ts` — DTO de búsqueda avanzada.
- `dto/sync-relations.dto.ts` — DTOs de sincronización (categorías, idiomas, inclusiones).
- `dto/photo.dto.ts` — DTOs de fotografías (crear, actualizar, respuesta).
- `dto/attraction-response.dto.ts` — DTO de respuesta con mapeo entidad→API.

### Módulo de Categorías (`src/modules/categories/`)

- `categories.module.ts`, `categories.controller.ts`, `categories.service.ts`
- `dto/create-category.dto.ts`, `dto/update-category.dto.ts`
- `dto/filter-categories-query.dto.ts`, `dto/category-response.dto.ts`

### Módulo de Idiomas (`src/modules/languages/`)

- `languages.module.ts`, `languages.controller.ts`, `languages.service.ts`
- `dto/create-language.dto.ts`, `dto/update-language.dto.ts`, `dto/language-response.dto.ts`

### Módulo de Inclusiones (`src/modules/inclusions/`)

- `inclusions.module.ts`, `inclusions.controller.ts`, `inclusions.service.ts`
- `dto/create-inclusion.dto.ts`, `dto/update-inclusion.dto.ts`
- `dto/filter-inclusions-query.dto.ts`, `dto/inclusion-response.dto.ts`

### Módulo de Operadores (`src/modules/operators/`)

- `operators.module.ts`, `operators.controller.ts`, `operators.service.ts`
- `dto/create-operator.dto.ts`, `dto/update-operator.dto.ts`
- `dto/filter-operators-query.dto.ts`, `dto/operator-response.dto.ts`
- `dto/operator-user.dto.ts` — DTOs de sub-recurso de usuarios del operador.

### Pruebas

- `test/unit/problem-details.filter.spec.ts` — 6 tests (HttpException, validación, errores PG, enmascaramiento).
- `test/unit/categories.service.spec.ts` — 8 tests (CRUD, slug, ciclos, árbol, guardas de borrado).
- `test/unit/languages-inclusions.service.spec.ts` — 5 tests (CRUD, unicidad, guardas).
- `test/unit/operators.service.spec.ts` — 4 tests (CRUD, unicidad de código, usuarios).
- `test/unit/attractions.service.spec.ts` — 6 tests (BORRADOR obligatorio, operador inactivo, estados, borrado lógico, 404 público).
- `test/e2e/api-v2.e2e-spec.ts` — 8 tests HTTP con servicios mock (rutas, Problem Details, X-Correlation-Id).

### Archivos modificados

- `src/main.ts` — Swagger/OpenAPI configurado en `/api/docs`.
- `src/configure-application.ts` — Middleware de correlación y ProblemDetailsFilter globales.
- `src/app.module.ts` — Registro de los cinco módulos nuevos.

## 3. Contrato REST implementado

### Consultas públicas

| Método | Ruta                                 | Descripción                                   |
| ------ | ------------------------------------ | --------------------------------------------- |
| GET    | /api/v2/atracciones                  | Listar atracciones PUBLICADAS con paginación  |
| GET    | /api/v2/atracciones/:id              | Detalle por ID, UUID o slug (solo PUBLICADAS) |
| POST   | /api/v2/atracciones/search           | Búsqueda avanzada con filtros en body         |
| GET    | /api/v2/atracciones/categorias       | Listar categorías (formato plano)             |
| GET    | /api/v2/atracciones/categorias/arbol | Árbol jerárquico de categorías                |
| GET    | /api/v2/idiomas                      | Listar idiomas                                |
| GET    | /api/v2/inclusiones                  | Listar inclusiones (filtro por tipo)          |

### Administración de atracciones

| Método | Ruta                                  | Descripción                             |
| ------ | ------------------------------------- | --------------------------------------- |
| POST   | /api/v2/atracciones                   | Crear atracción (siempre en BORRADOR)   |
| PATCH  | /api/v2/atracciones/:id               | Actualizar parcialmente                 |
| PATCH  | /api/v2/atracciones/:id/estado        | Cambiar estado                          |
| DELETE | /api/v2/atracciones/:id               | Borrado lógico (atr_eliminado_en)       |
| PUT    | /api/v2/atracciones/:id/categorias    | Sincronizar categorías (transaccional)  |
| PUT    | /api/v2/atracciones/:id/idiomas       | Sincronizar idiomas (transaccional)     |
| PUT    | /api/v2/atracciones/:id/inclusiones   | Sincronizar inclusiones (transaccional) |
| POST   | /api/v2/atracciones/:id/fotos         | Agregar fotografía                      |
| PATCH  | /api/v2/atracciones/:id/fotos/:fotoId | Actualizar fotografía                   |
| DELETE | /api/v2/atracciones/:id/fotos/:fotoId | Eliminar fotografía                     |

### Catálogos auxiliares

| Método | Ruta                               | Descripción                  |
| ------ | ---------------------------------- | ---------------------------- |
| GET    | /api/v2/idiomas/:id                | Detalle de idioma            |
| POST   | /api/v2/idiomas                    | Crear idioma                 |
| PATCH  | /api/v2/idiomas/:id                | Actualizar idioma            |
| DELETE | /api/v2/idiomas/:id                | Eliminar idioma              |
| GET    | /api/v2/inclusiones/:id            | Detalle de inclusión         |
| POST   | /api/v2/inclusiones                | Crear inclusión              |
| PATCH  | /api/v2/inclusiones/:id            | Actualizar inclusión         |
| DELETE | /api/v2/inclusiones/:id            | Eliminar inclusión           |
| POST   | /api/v2/atracciones/categorias     | Crear categoría              |
| PATCH  | /api/v2/atracciones/categorias/:id | Actualizar categoría         |
| DELETE | /api/v2/atracciones/categorias/:id | Eliminar categoría           |
| GET    | /api/v2/operadores                 | Listar operadores (paginado) |
| GET    | /api/v2/operadores/:id             | Detalle de operador          |
| POST   | /api/v2/operadores                 | Crear operador               |
| PATCH  | /api/v2/operadores/:id             | Actualizar operador          |
| DELETE | /api/v2/operadores/:id             | Desactivar/eliminar operador |
| GET    | /api/v2/operadores/:id/usuarios    | Listar usuarios del operador |
| POST   | /api/v2/operadores/:id/usuarios    | Asociar usuario              |
| PATCH  | /api/v2/operadores/:id/usuarios/:u | Actualizar asociación        |
| DELETE | /api/v2/operadores/:id/usuarios/:u | Desasociar usuario           |

## 4. Decisiones técnicas aplicadas

### Manejo de errores

- Filtro global ProblemDetailsFilter que produce `application/problem+json` con campos `type`, `title`,
  `status`, `detail`, `instance`, `code`, `correlation_id` y `timestamp`.
- Mapeo de errores PostgreSQL: 23505→409 Conflict, 23503→409 Conflict, 23514→400 Bad Request.
- Los errores internos (500) enmascaran detalles sensibles; no exponen stack traces ni consultas SQL.

### Correlación de solicitudes

- Middleware que propaga `X-Correlation-Id` de la solicitud o genera UUID v4 automáticamente.
- El ID se incluye en la cabecera de respuesta y en el body de Problem Details.

### Reglas de negocio implementadas

- **Atracciones**: creación siempre en BORRADOR; estados válidos: BORRADOR, PUBLICADA, INACTIVA;
  borrado lógico con atr_eliminado_en; slug único; UUID público; validación de operador activo;
  consultas públicas filtran por PUBLICADA + no eliminada; búsqueda por ID/UUID/slug.
- **Categorías**: jerarquía padre-hijo; detección de ciclos indirectos; slug autogenerado;
  guardas de borrado (subcategorías, atracciones asociadas).
- **Idiomas**: código ISO normalizado a minúsculas; guarda de borrado (atracciones asociadas).
- **Inclusiones**: validación de tipo (INCLUYE, NO_INCLUYE, RECOMENDACION); unicidad (tipo, nombre);
  guarda de borrado (atracciones asociadas).
- **Operadores**: código único; validación de RUC/correo/teléfono según SQL; desactivación en lugar
  de eliminación cuando tiene atracciones; sub-recurso de usuarios con roles.

### Campos de proyección Review

- `atr_calificacion_promedio` y `atr_numero_resenas` son de solo lectura (insert: false, update: false).
- No se implementó consumidor de eventos. La integración RESENA_PUBLICADA queda documentada como pendiente.

### DTOs con Ley de Postel

- Los DTOs de entrada aceptan tanto nombres en inglés (`name`) como en español (`nombre`)
  mediante helpers @Transform tipados en dto-utils.ts.
- Campos compatibles con el contrato Booking: name, slug, description, short_description,
  duration_hours, free_cancellation, meeting_point, photos.

### Swagger/OpenAPI 3

- Documentación completa disponible en `/api/docs` con SwaggerModule.setup().
- Decoradores @ApiTags, @ApiOperation, @ApiParam, @ApiOkResponse, @ApiCreatedResponse,
  @ApiNoContentResponse, @ApiBadRequestResponse, @ApiNotFoundResponse, @ApiConflictResponse.
- Seguridad Bearer JWT declarada (preparada para Fase E).
- Parámetro global X-Correlation-Id documentado.

## 5. Resultados reales

| Verificación             | Resultado                       |
| ------------------------ | ------------------------------- |
| Lint (--max-warnings=0)  | Aprobado, 0 errores, 0 warnings |
| Typecheck (tsc --noEmit) | Aprobado                        |
| Build (nest build)       | Aprobado                        |
| Jest unitarias           | 52 aprobadas, 7 suites          |
| Jest e2e HTTP            | 10 aprobadas, 2 suites          |
| Total Jest               | 62 casos aprobados              |

Desglose de pruebas unitarias: catalog-domains (5), environment (1), problem-details.filter (6),
categories.service (8), languages-inclusions.service (5), operators.service (4), attractions.service (6),
total original preservado: 23 de Fase C + 29 nuevos = 52.

Desglose de pruebas e2e: health (2 originales) + api-v2 (8 nuevos) = 10.

## 6. Errores corregidos

1. **ESLint no-unsafe-\* en @Transform**: 313 errores iniciales por `obj: unknown` en decoradores.
   Resuelto creando helpers tipados en dto-utils.ts.
2. **Test toThrow('substring')**: CatalogException.message no incluía el detail.
   Resuelto pasando `message: detail` al constructor de HttpException.
3. **ESLint no-unnecessary-type-assertion en tests**: Casteos innecesarios eliminados.
4. **Mock repository lint errors**: jest.fn() con casts producía unsafe-return.
   Resuelto usando clases fake tipadas en lugar de mocks con cast.
5. **FakeAttractionRepo.createQueryBuilder()**: Cada llamada a leftJoinAndSelect creaba un builder nuevo,
   perdiendo el estado de filtros. Resuelto usando objeto builder con referencia estable.
6. **E2E route collision**: AttractionsController @Get(':id') capturaba `/categorias` como :id.
   Resuelto registrando CategoriesController antes de AttractionsController.
7. **E2E TypeORM dependency**: Modules con TypeOrmModule.forFeature() fallaban sin conexión.
   Resuelto registrando controladores y providers directamente sin importar módulos.

## 7. Riesgos y pendientes

### Pendientes inmediatos (Fase E)

- **JWT/RBAC**: Las rutas administrativas no tienen autenticación. Pendiente contrato Identity.
- **Validación de IDs externos**: city_id y province_id no se validan contra ms_location.
- **Evento RESENA_PUBLICADA**: No hay consumidor de eventos; los campos de proyección son solo lectura.
- **Transiciones de estado**: No hay restricciones formales de transición (p.ej. INACTIVA→BORRADOR).
- **Propiedad de operador**: No se valida que el usuario autenticado pertenezca al operador.

### Limitaciones conocidas

- La prueba Docker no se ejecutó en este entorno (Docker no disponible).
- Las pruebas de integración (50 casos) no se re-ejecutaron: requieren PostgreSQL.
- El Swagger genera schemas automáticos; los DTOs de respuesta son interfaces, no clases con @ApiProperty.
- No se modificó el SQL maestro ni el contrato externo.

## 8. Criterios de aceptación cumplidos

- 35+ operaciones REST implementadas bajo /api/v2.
- Problem Details RFC 7807 en todas las respuestas de error.
- X-Correlation-Id propagado en solicitudes y respuestas.
- Swagger UI funcional en /api/docs.
- Reglas de negocio: BORRADOR obligatorio, estados válidos, borrado lógico, slug único, ciclos de categorías,
  guardas de borrado, validación de operador activo, sincronización transaccional de relaciones.
- 62 pruebas pasando (52 unitarias + 10 e2e).
- Lint, typecheck y build sin errores ni warnings.
- Sin modificaciones al SQL v2 ni al contrato externo OpenAPI.
- Sin despliegue ni infraestructura remota.

## 9. Autorización siguiente

Detener después de Fase D. Solicitar aprobación para comenzar Fase E:
autenticación JWT/RBAC, validación de propiedad de operadores, transiciones de estado formales,
integración con ms_identity y ms_location, y consumidor del evento RESENA_PUBLICADA (si hay contrato).
