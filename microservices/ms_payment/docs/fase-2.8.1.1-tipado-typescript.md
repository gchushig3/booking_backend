# Fase 2.8.1.1 — Corrección de tipado TypeScript en pruebas

Fecha: 2026-10-27, America/Guayaquil. **Completada: chequeo global sin errores y 258 pruebas aprobadas.** Cambios limitados a cinco fixtures de QueryFailedError en cuatro archivos de pruebas. Ningún cambio productivo, contractual, de configuración o de PostgreSQL.

## 1. Inspección y reproducción real

Se revisaron el [informe 2.8.1](fase-2.8.1-preparacion-seguridad.md), tsconfig.json, tsconfig.build.json, las tres configuraciones Vitest, los tests afectados, el helper productivo de detección de unicidad y la declaración/implementación instaladas de TypeORM QueryFailedError. No se modificó TypeORM.

Comando inicial: `npx.cmd --no-install tsc --noEmit --incremental false`, equivalente al solicitado usando el TypeScript local, sin permitir instalación. Se usaron ejecutables .cmd en PowerShell sin cambiar políticas del equipo.

**El estado actual no reproduce los nueve errores históricos: reproduce cinco TS2353, sin errores adicionales.** Los cuatro TS18048 de integración ya estaban resueltos antes de esta fase mediante getDataSource(). No se reintrodujeron ni se modificó ese archivo para atribuir una corrección inexistente.

### Cinco diagnósticos reproducidos al inicio

Las ubicaciones son las originales, antes de editar los fixtures:

| # | Archivo | Línea:columna | Código | Diagnóstico |
|---|---|---|---|---|
| 1 | src/common/api-exception.filter.spec.ts | 43:9 | TS2353 | Object literal may only specify known properties, and 'code' does not exist in type 'Error'. |
| 2 | src/pago/pago.service.spec.ts | 281:54 | TS2353 | Mismo diagnóstico al construir fixture23505 de INSERT |
| 3 | src/pago/pago.service.spec.ts | 490:9 | TS2353 | Mismo diagnóstico al construir fixture23505 de UPDATE con constraint |
| 4 | src/pago_tarjeta/pago_tarjeta.service.spec.ts | 171:62 | TS2353 | Mismo diagnóstico al construir fixture23505 de detalle |
| 5 | src/pago_transferencia/pago_transferencia.service.spec.ts | 172:9 | TS2353 | Mismo diagnóstico al construir fixture23505 de detalle |

### Cuatro diagnósticos históricos, no reproducidos ahora

Se registran para conciliar los nueve del informe previo. Las líneas corresponden a las referencias que originaban los diagnósticos históricos; **el chequeo inicial de esta fase no emitió estos errores**:

| # | Archivo | Línea histórica | Código histórico | Estado encontrado |
|---|---|---|---|---|
| 6 | test/payment.integration-spec.ts | 169 | TS18048 | options ya usa getDataSource() |
| 7 | test/payment.integration-spec.ts | 179 | TS18048 | Consulta current_database ya usa getDataSource() |
| 8 | test/payment.integration-spec.ts | 184 | TS18048 | Consulta de catálogos ya usa getDataSource() |
| 9 | test/payment.integration-spec.ts | 191 | TS18048 | Consulta de tablas ya usa getDataSource() |

El diagnóstico histórico era `'dataSource' is possibly 'undefined'`. No quedan diagnósticos de ninguno de los dos grupos tras la corrección de los cinco vigentes.

## 2. Causa técnica y corrección

La declaración instalada es `QueryFailedError<T extends Error = Error>` y su constructor recibe driverError:T. Los fixtures utilizaban objetos literales que contenían code/constraint/detail, pero no eran Error. El compilador señala code en esos literales; no es un defecto en el acceso productivo al código PostgreSQL. El helper productivo ya comprueba instancia QueryFailedError y que driverError sea un objeto no nulo con code23505.

Se sustituyó cada literal de driverError por una instancia Error extendida mediante Object.assign, dejando iguales los atributos usados por la lógica probada:

```ts
new QueryFailedError(
  'INSERT INTO pago',
  [],
  Object.assign(new Error(), { code: '23505' }),
);
```

La inferencia obtiene Error junto con las propiedades PostgreSQL concretas. No se necesita aserción de tipos, any, supresión, genérico falso ni cambio de librería. Se conserva la construcción real de QueryFailedError y su detección instanceof. El mensaje sintético del driver no se usa para decisiones de negocio ni se expone; los tests continúan exigiendo mensajes seguros.

No se creó un helper compartido: cinco expresiones pequeñas con diferentes metadatos no justifican otra abstracción. No se alteraron catch, validaciones, códigos HTTP o aserciones.

| Fixture | Propiedades PostgreSQL conservadas | Comportamiento que sigue probado |
|---|---|---|
| Filtro | code23514, detail sintético | Respuesta500 genérica sin SQL/parámetros/detalle del driver |
| Crear pago | code23505 | Reintento equivalente200 por carrera de unicidad, sin duplicado |
| Simular pago | code23505, constraint ux_pago_orden_aprobado | Conflicto409 ORDER_ALREADY_HAS_APPROVED_PAYMENT |
| Detalle tarjeta | code23505 | Conflicto por detalle concurrente, sin duplicado |
| Detalle transferencia | code23505 | Conflicto por detalle concurrente, sin duplicado |

## 3. DataSource y ciclo de vida conservados

getDataSource() ya existe: comprueba que la referencia esté definida, lanza Error explícito si falta y devuelve DataSource no opcional. beforeAll valida el entorno aislado **antes de conectar**, crea Nest, espera app.init(), obtiene el DataSource existente y usa ese helper para las cuatro referencias. No crea otra conexión ni sustituye una ausencia por éxito.

Los tests usan esa misma conexión. afterAll conserva la condición dataSource?.isInitialized, el DELETE parametrizado de números propios, RETURNING, las comprobaciones de limpieza y app.close(). No se añadieron operadores !, as DataSource, cambios de strictNullChecks o alteraciones de limpieza. **test/payment.integration-spec.ts no se modificó en esta fase.**

## 4. Archivos modificados y preservación de alcance

- src/common/api-exception.filter.spec.ts: un fixture.
- src/pago/pago.service.spec.ts: dos fixtures.
- src/pago_tarjeta/pago_tarjeta.service.spec.ts: un fixture.
- src/pago_transferencia/pago_transferencia.service.spec.ts: un fixture.
- docs/fase-2.8.1.1-tipado-typescript.md: este informe nuevo.

Comparación SHA256 contra111 archivos registrados al inicio: cambiaron únicamente los cuatro tests anteriores; los otros107 permanecieron idénticos. Incluye código productivo, ambos contratos, SQL oficial/inicializadores, tsconfig, Vitest, package/lock, entorno, seguridad preparatoria y harness RS256. Los cambios de fases previas que ya estaban en Git no se atribuyen a esta fase. Archivos temporales/build están ignorados y fuera de la comparación.

No se modificaron rutas, DTOs, pipes, entidades, servicios, filtros productivos, módulos, permisos o reglas de simulación. No se activaron JWT/guards ni integraciones Identity/Order.

## 5. Resultados de regresión, en el orden solicitado

| Orden | Comando | Resultado |
|---|---|---|
| 1 | npx tsc --noEmit --incremental false | **Aprobado, cero diagnósticos**, exit0 |
| 2 | npm run build | Aprobado, exit0 |
| 3 | npm run lint | Aprobado, exit0 |
| 4 | npm test | **193 aprobadas**,21 archivos, exit0 |
| 5 | npm run test:e2e | **11 aprobadas**,1 archivo, exit0 |
| 6 | npm run test:integration | **54 aprobadas**,1 archivo, exit0 |
| | **Total** | **258 aprobadas, cero fallos** |

El comando global usó npx.cmd --no-install; los scripts usaron npm.cmd. No se excluyeron pruebas del chequeo ni se modificó tsconfig. Ningún test se eliminó o deshabilitó; no se debilitaron aserciones. La regresión HTTP conserva las doce operaciones y sus respuestas actuales.

## 6. Aislamiento PostgreSQL y limpieza

Antes de las suites HTTP se verificó por docker inspect exclusivamente el contenedor ms_payment_postgres_test: running=true, health=healthy, publicación5432/tcp en **127.0.0.1:5434**. La inspección necesitó acceso Docker fuera del sandbox, fue de solo lectura y no inició/modificó contenedores.

Se cargó y comprobó la configuración efectiva de pruebas, sin imprimir credenciales:

```text
NODE_ENV=test
DB_HOST=127.0.0.1
DB_PORT=5434
DB_DATABASE=ms_payment_test
```

Las suites mantienen sus comprobaciones de destino antes de conectar; integración verifica nombre real de base y synchronize=false/dropSchema=false/migrationsRun=false. No se conectó ni consultó la base de desarrollo. No se ejecutaron DDL, migraciones, reinicialización, TRUNCATE, cambios de secuencias ni escrituras de catálogos.

La limpieza existente comprobó cero pagos propios y cero detalles de tarjeta/transferencia de los registros borrados. Consulta posterior independiente, con comprobación previa del destino aislado, confirmó:

```text
database=ms_payment_test
remaining_integration_rows=0
```

## 7. Riesgos restantes y cierre

No quedan errores TypeScript globales conocidos al terminar esta fase. Los informes anteriores se conservan como registro histórico: su pendiente de nueve diagnósticos queda resuelto por el estado actual y las correcciones documentadas aquí, sin reescribir evidencias previas.

La verificación de firma/identidad y la autorización HTTP continúan inactivas; los contratos internos de Fase2.8.1 no son autenticación real. Las decisiones externas de Identity, perfil JWT y propiedad de recursos siguen pendientes y fuera de alcance. No se realizaron pagos reales. **Detener aquí antes de Fase2.8.2.**
