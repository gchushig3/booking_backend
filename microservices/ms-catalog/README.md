# ms-catalog — Descubre EC

Estado actual: integracion Neon, Identity, CloudAMQP y catalogo Booking implementada. Ver [configuracion y migracion](docs/infraestructura-booking.md). Las secciones de cierre Fase H siguientes conservan el estado historico previo a esta integracion.

Catalog & Attractions Service, proyecto NestJS autónomo con raíz Git propia en este directorio; todavía sin commits.
Estado: Fase H, entrega técnica local preparada; el objetivo de administración operativa sigue bloqueado.
Administración bloqueada por defecto (401); JWT/RBAC y propiedad por operador pendientes del contrato Identity.

Documentos de cierre: [entrega técnica](docs/entrega-tecnica.md),
[integraciones y decisiones pendientes](docs/integraciones-pendientes.md),
[informe H](docs/fase-h.md) y [evidencia H](docs/fase-h-evidence.json).

## Requisitos

Node.js 24 (>=24.9), npm 11 o 12, Docker Engine/Desktop con Compose y Git.
NestJS 12, TypeScript 6, TypeORM 0.3 y PostgreSQL 16. Dependencias fijadas en package-lock.json.
En PowerShell con scripts restringidos, usar npm.cmd; no cambiar ExecutionPolicy.

## Ejecución local con Docker

```sh
npm run env:local
docker compose config --quiet
docker compose up --build -d --wait
curl http://localhost:3014/api/v2/health/live
docker compose ps
```

El script de entorno usa solo Node y puede ejecutarse antes de instalar dependencias.
Genera .env con contraseña local aleatoria, sin imprimirla ni sobrescribir un archivo existente.
No versionar .env ni .env.test. .env.example es una plantilla cuya contraseña debe sustituirse.

Si el volumen PostgreSQL es nuevo, database/docker-init.sh verifica SHA256SUMS y aplica el bloque SQL
Catalog en una transacción antes de completar el arranque. Se crean exclusivamente las diez tablas,
cuatro dominios, extensiones, índices, triggers, vista y seeds aprobados.
Si el volumen ya fue inicializado, PostgreSQL no repite los scripts de initdb.
Para un volumen existente todavía sin esquema Catalog, usar el inicializador manual descrito abajo.
Un volumen parcialmente inicializado por un fallo requiere inspección explícita: no se borra ni repara automáticamente.

Puertos publicados solo en loopback: HTTP 3014, PostgreSQL 5444.
Compose mantiene una red interna y una segunda red bridge que permite acceso local y salida a Internet.
PostgreSQL conserva datos en un volumen propio. La aplicación espera su healthcheck y la inicialización de TypeORM.
La sonda /api/v2/health/live indica únicamente que el proceso HTTP responde; no certifica disponibilidad continua de la base.
La imagen de aplicación usa UID 1000, filesystem de solo lectura y no incorpora .env.
El usuario PostgreSQL de bootstrap es exclusivo de desarrollo; falta definir privilegios para producción.

Para detener conservando datos:

```sh
docker compose down
```

No usar down -v salvo decisión explícita de eliminar los datos locales.
Cambiar DB_PASSWORD en .env no cambia la contraseña de un volumen ya inicializado.

## Desarrollo con Node

```sh
npm ci
npm run env:local
docker compose up -d postgres --wait
npm run start:dev
```

Node carga .env y accede por 127.0.0.1:5444. Dentro de Compose se usa postgres:5432.
Para ejecutar el build: npm run build y npm run start:prod.

## Inicialización manual controlada

```sh
npm ci
npm run build
npm run db:apply
```

db:apply requiere .env, NODE_ENV=development y la base ms_catalog vacía de objetos de aplicación.
Comprueba la huella del SQL, la base real y PostgreSQL 16. Usa transacción y advisory lock.
Rechaza una base con tablas, vistas, secuencias, dominios o funciones propias: repetirlo termina con error
sin recrear objetos ni duplicar seeds. No es una migración incremental ni un comando de reparación.
No hay down automático ni tabla adicional de historial de migraciones.

La fuente es database/migrations/001-catalog.sql, copia del bloque ms_catalog del SQL v2, sin el comando psql
\connect ni instrucciones para crear otras bases. database/source.json registra procedencia y SHA-256;
.gitattributes conserva LF para mantener la huella entre sistemas operativos.
Los seeds originales están dentro de ese mismo script y se aplican una sola vez; no hay una segunda copia.
No ejecutar el SQL maestro completo: contiene objetos de los demás microservicios.

## Modelo de persistencia

Las entidades de src/database/entities representan operador, operador_usuario, categoria, idioma,
inclusion, atraccion, atraccion_categoria, atraccion_idioma, atraccion_inclusion y atraccion_foto.
AtraccionCompletaView representa v_atraccion_completa. Esa vista incluye borradores y RUC; no es un DTO público.

En persistencia BIGINT y NUMERIC se conservan como cadenas. Los IDs INTEGER/SMALLINT usan number.
Los DTOs públicos mantienen BIGINT como string y convierten coordenadas, duración y calificación a number.
Los cuatro dominios conservan sus nombres en los metadatos ORM y PostgreSQL aplica sus CHECK reales.
TypeORM 0.3 no los enumera de forma nativa; catalog-domains.ts amplía solo la lista de tipos de cada DataSource
para los cuatro nombres aprobados. Esta adaptación está verificada con PostgreSQL 16 y requiere regresión al actualizar TypeORM.
No modifica el driver global, no genera DDL y no reemplaza dominios por columnas varchar.

synchronize=false, dropSchema=false y migrationsRun=false en todos los entornos.
Las entidades y la vista también excluyen sincronización; la fábrica rechaza habilitar DDL automático.
Los triggers originales controlan timestamps. Las columnas de proyección Review no se escriben mediante save ORM;
no existe consumidor de eventos. DeleteDateColumn usa atr_eliminado_en y las consultas ORM normales excluyen borrados.
La vista SQL conserva su comportamiento original y requiere filtros explícitos al usarla.

Las relaciones solo apuntan a tablas Catalog. prov_id, ciu_id y usu_id siguen como IDs lógicos, sin FK ni tablas externas.
La detección de ciclos indirectos, la publicación y la autorización de operadores corresponden a servicios de Fase D/E.
El SQL solo impide autoparentesco de categorías; no se cambió para agregar reglas no aprobadas.

## Pruebas

```sh
npm run lint
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run env:test
docker compose --env-file .env.test -f compose.test.yaml up -d --wait
npm run test:integration
npm run test:docker-bootstrap
docker compose up -d --build --wait
npm run test:local-stack -- --phase=h
npm run format:check
```

Las pruebas de integración exigen NODE_ENV=test y ms_catalog_test en 127.0.0.1/localhost:5445.
El Compose de pruebas tiene un proyecto y un volumen propios; no escribe en ms_catalog.
Si la base está vacía, la suite aplica el inicializador una vez; si existe, verifica el esquema.
La suite de persistencia usa una transacción por caso y revierte sus fixtures, incluidos errores SQL mediante savepoints.
La suite HTTP con AppModule y servicios reales confirma fixtures exclusivamente en la base de pruebas,
para que las conexiones del pool puedan leerlas; al terminar elimina únicamente los IDs que creó.
No hay overrides de servicio ni bypass del guard en esa suite. Al finalizar solo quedan los seeds originales.
Las secuencias identity pueden avanzar durante estas pruebas.

La suite verifica columnas y metadatos, tipos, dominios, identidad ALWAYS, defaults, restricciones, claves,
índices y búsqueda GIN, relaciones, cascadas/restricciones de borrado, triggers, vista, borrado lógico,
protección de proyecciones, fotografías y paginación. La suite HTTP adicional comprueba búsqueda y paginación reales,
detalle por ID/UUID/slug, relaciones, visibilidad, validación, Swagger y denegación de administración sin escrituras.
Incluye regresiones para parámetros bigint/varchar y para identificadores fuera del rango bigint.
El manifiesto esperado se extrajo del SQL v2; no sustituye la fuente aprobada.

La prueba Docker crea contenedores temporales sin red ni puertos publicados. Comprueba bootstrap con diez tablas,
persistencia de seeds tras reinicio y rollback completo ante un error SQL inyectado en una copia temporal.
Elimina únicamente sus propios contenedores y archivos temporales; no elimina volúmenes de Compose.

`test:local-stack` requiere el Compose principal en ejecución. Verifica el proyecto y directorio,
consultas públicas, Swagger y las 30 operaciones administrativas bloqueadas; reinicia solo aplicación
y PostgreSQL de Catalog y repite las comprobaciones. No inserta datos, no elimina volúmenes y deja
los contenedores activos. Regenera `docs/fase-g-evidence.json` sin credenciales; con `-- --phase=h` guarda
`docs/fase-h-evidence.json` y conserva la evidencia G.

Resultados de cierre H: 76 unitarias, 57 e2e y 68 de integración aprobadas (201 en total);
lint, formato, typecheck, build y OpenAPI aprobados. Contenedor actualizado, consultas HTTP y persistencia
tras reinicio comprobados. El bootstrap y rollback del SQL se verificaron en G, sin cambios posteriores.
Swagger del stack comprobado: `http://localhost:3014/api/docs`.
Ver [informe H](docs/fase-h.md), [evidencia H](docs/fase-h-evidence.json) y [antecedente G](docs/fase-g.md).
Las operaciones administrativas autorizadas permanecen pendientes del contrato Identity.

Jest usa ts-jest ESM y la bandera experimental de VM Modules.
Las e2e cubren HealthModule, consultas públicas, Swagger y denegación administrativa con servicios de prueba;
no prueban todavía rutas administrativas con autenticación real.
Detener la base de pruebas conservando datos con:

```sh
docker compose --env-file .env.test -f compose.test.yaml down
```

## Swagger y contrato interno

Swagger UI: `http://localhost:3014/api/docs` (puerto configurable).
JSON: `/api/docs-json`. YAML: `/api/docs-yaml`. Negocio: `/api/v2`.

- [Contrato OpenAPI generado](docs/openapi.yaml).
- [Matriz HTTP actual](docs/endpoints.md).
- [Evidencia de Fase F](docs/fase-f.md).

```sh
npm run openapi:export
npm run openapi:check
npm run test:e2e
```

La exportación compila el código y monta los controladores reales con proveedores vacíos,
sin conexión PostgreSQL ni llamadas de negocio. Solo consulta el YAML de Swagger;
no sirve respuestas simuladas como datos reales. No requiere `.env`.
`openapi:check` falla si el contrato o la matriz no coinciden con Swagger.
En PowerShell puede utilizarse `npm.cmd`.

La administración devuelve únicamente `401 AUTHENTICATION_UNAVAILABLE` para cualquier token.
Swagger conserva Bearer como reservado, marca `x-admin-blocked` y separa las respuestas previstas
de los servicios en `x-intended-responses`; estas últimas no son respuestas HTTP operativas.
No hay autenticación JWT funcional ni roles definitivos. El campo `role` de asociación mantiene
la validación existente ADMIN/VENDEDOR/GUIA, que no constituye una política RBAC aprobada.
`X-Correlation-Id` es texto propagado o generado, no exige UUID.
Los valores de ejemplo son ilustrativos, no representan registros insertados.

## Contratos e integraciones pendientes

La [matriz generada](docs/endpoints.md) es la referencia efectiva de métodos, rutas,
acceso y respuestas. Son 38 operaciones: siete consultas públicas de negocio, una sonda liveness
y 30 operaciones bloqueadas por Identity. No se presenta el código administrativo como acceso autorizado.
El [registro de pendientes](docs/integraciones-pendientes.md) detalla contratos, decisiones y revisiones
necesarias antes de abrir administración.

Fuentes inspeccionadas: microservices/flujo_trabajo.md, SQL v2 y contracts/atracciones-openapi-v3.yaml del repositorio de referencia.
El servicio es autónomo y no necesita ese checkout para ejecutar, inicializar su base o probarse.
No se modificó el SQL maestro ni el contrato externo; este último contiene claves duplicadas en TimeSlotItem.

Pendientes: perfil JWT/RBAC y vínculo del sujeto
con usu_id, validación por API de IDs Identity/Location, contrato RESENA_PUBLICADA de Review
y transiciones de estado formales.
No se infieren flags de inclusión, escala de rating, coordenadas del punto de encuentro ni restricciones de publicación no aprobadas.
No hay Azure, Render, registros remotos ni CD. Ejecución local exclusivamente.

## Evidencias y uso de IA

Codex preparó las fases autorizadas y ejecutó las verificaciones registradas en docs/fase-b.md, docs/fase-c.md, docs/fase-d.md, docs/fase-e.md, docs/fase-f.md, docs/fase-g.md y docs/fase-h.md.
Los informes distinguen persistencia y pruebas reales de integraciones todavía pendientes.
La Fase H fue autorizada y la entrega local está preparada. No se inicia trabajo posterior ni despliegue;
la continuación requiere contratos aprobados y autorización explícita.
