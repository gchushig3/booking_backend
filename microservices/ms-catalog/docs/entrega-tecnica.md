# Entrega técnica local de ms_catalog

Fecha: 2026-10-28, America/Guayaquil. Versión del proyecto: `0.1.0`.
Versión de API interna: `v2`.

**Entrega local verificable con administración bloqueada.** Las consultas públicas,
persistencia, Swagger y Docker están comprobados. JWT/RBAC, propiedad de operadores
y escrituras HTTP autenticadas siguen pendientes; el objetivo de un microservicio
con administración completamente operativa todavía no está cumplido.

## Acceso y documentos

| Elemento                                   | Referencia                                                 |
| ------------------------------------------ | ---------------------------------------------------------- |
| Guía de ejecución, configuración y pruebas | [README](../README.md)                                     |
| Swagger UI                                 | `http://localhost:3014/api/docs`                           |
| Liveness                                   | `http://localhost:3014/api/v2/health/live`                 |
| Documento JSON/YAML                        | `/api/docs-json`, `/api/docs-yaml`                         |
| OpenAPI exportado                          | [openapi.yaml](openapi.yaml)                               |
| Matriz efectiva de operaciones             | [endpoints.md](endpoints.md)                               |
| Contratos y decisiones pendientes          | [integraciones-pendientes.md](integraciones-pendientes.md) |
| Informe de cierre                          | [fase-h.md](fase-h.md)                                     |
| Evidencia del contenedor entregado         | [fase-h-evidence.json](fase-h-evidence.json)               |
| Pruebas y bootstrap de PostgreSQL          | [fase-g.md](fase-g.md)                                     |

## Estructura y límites

`src/main.ts` instala configuración global, logs JSON y Swagger. Los cinco módulos
de negocio separan controladores, DTOs, servicios y repositorios. La conexión TypeORM
se configura en `src/database`, con entidades y vista de Catalog exclusivamente.
`common` contiene validación, errores, correlación y el guard de denegación.

La base `ms_catalog` contiene exactamente `operador`, `operador_usuario`, `categoria`,
`idioma`, `inclusion`, `atraccion`, `atraccion_categoria`, `atraccion_idioma`,
`atraccion_inclusion` y `atraccion_foto`, además de `v_atraccion_completa`.
No hay tablas ni FK a otros microservicios. Los IDs de Identity y Location son
referencias lógicas; no se creó integración remota ficticia.

La migración inicial es el bloque SQL aprobado copiado en
`database/migrations/001-catalog.sql`. Su SHA-256 es
`a2fa43418443e060597f967d67c28b7f40dcd21d95a60be382fad9fe44ace75e`.
No hay sincronización automática, reparación destructiva ni migraciones incrementales
inventadas. Los dominios, UUID, timestamps, restricciones y seeds pertenecen al SQL.

## Ejecución desde una copia del proyecto

Ejecutar en la raíz de `ms-catalog`, con Docker activo y puertos 3014/5444 libres:

```sh
npm run env:local
docker compose config --quiet
docker compose up -d --build --wait
```

Abrir Swagger o consultar `/api/v2/health/live`. El entorno se genera con contraseña
aleatoria local y no sobrescribe `.env` existente. No es necesario instalar las
dependencias Node del host para arrancar el stack Docker.

Si la base es nueva, el bootstrap aplica y verifica el SQL dentro de una transacción.
Un volumen existente se conserva y no se reinicializa. Para inicializar manualmente
una base local vacía: `npm ci`, `npm run build` y `npm run db:apply`; una segunda
aplicación debe ser rechazada. No ejecutar ese comando como reparación de un esquema
parcial ni eliminar el volumen para superar un error.

Para desarrollo con Node se necesita `npm ci`, arrancar solo PostgreSQL y ejecutar
`npm run start:dev`. Evitar arrancar simultáneamente Node y la aplicación Compose
sobre el mismo puerto. En PowerShell usar `npm.cmd` si `npm.ps1` está restringido;
no es necesario modificar ExecutionPolicy.

## Reproducir la verificación

Con dependencias de desarrollo instaladas:

```sh
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run env:test
docker compose --env-file .env.test -f compose.test.yaml up -d --wait
npm run test:integration
npm run openapi:check
docker compose up -d --build --wait
npm run test:local-stack -- --phase=h
```

La integración solo admite `ms_catalog_test` en loopback:5445 y usa fixtures de prueba
con limpieza. El smoke test final no introduce datos en `ms_catalog`, pero reinicia
sus dos contenedores y deja los servicios activos. `--phase=h` guarda evidencia H
y conserva la evidencia histórica de G.

El bootstrap y su rollback ante fallo SQL se verificaron en G mediante
`npm run test:docker-bootstrap`. Crea contenedores temporales propios y los limpia;
no elimina volúmenes de Compose. No se repitió en H porque no cambió SQL/bootstrap.

## Estado de aceptación

| Criterio                         | Estado y evidencia                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| Build, lint, formato y tipos     | Aprobados al cierre H                                                                   |
| Unitarias                        | 76 aprobadas, 8 suites                                                                  |
| E2E HTTP con servicios de prueba | 57 aprobadas, 3 suites                                                                  |
| Integración con PostgreSQL real  | 68 aprobadas, 2 suites; incluye AppModule/HTTP real                                     |
| Total Jest                       | 201 aprobadas, 13 suites                                                                |
| Consultas públicas y visibilidad | Comprobadas, con borradores/inactivas/eliminadas ocultas                                |
| Seguridad de administración      | Denegación de las 30 operaciones comprobada; JWT/RBAC pendiente                         |
| Esquema y seeds                  | Verificados en PostgreSQL 16; diez tablas y cuatro dominios                             |
| OpenAPI                          | Coincide con la configuración servida; parámetros, DTOs y errores documentados          |
| Docker y persistencia            | Healthchecks, HTTP y mismo volumen comprobados antes/después del reinicio               |
| Credenciales locales             | `.env` y `.env.test` excluidos; sus contraseñas no aparecen en candidatos Git revisados |
| Despliegue                       | No realizado ni autorizado por esta entrega                                             |

Los valores inválidos proporcionados en filtros numéricos, booleanos y de texto
ya no se convierten silenciosamente en campos ausentes cuando existe una validación
de tipo. Las representaciones válidas y los valores predeterminados se conservaron;
las regresiones se probaron con DTOs y con HTTP/PostgreSQL real.

## Operación y resolución de problemas

`docker compose ps` muestra el estado local. `docker compose logs --tail 100 app`
permite revisar el arranque. `X-Correlation-Id` enlaza los errores Problem Details;
los errores inesperados no exponen consultas, credenciales ni stack traces al consumidor.
La sonda HTTP indica que el proceso está vivo; no demuestra disponibilidad continua
de PostgreSQL.

Un `401 AUTHENTICATION_UNAVAILABLE` en administración es el comportamiento previsto.
No hay token de prueba ni variable para desactivar el guard. Las listas de atracciones
pueden estar vacías: esta entrega no genera operadores o atracciones operativos de ejemplo.

Ante un conflicto de puerto, ajustar el puerto de desarrollo y el entorno de forma
coherente; las pruebas de integración mantienen su destino aislado fijo. Si cambia
la contraseña de `.env`, recordar que el volumen existente conserva las credenciales
con las que se inicializó.

Detener sin eliminar datos:

```sh
docker compose down
docker compose --env-file .env.test -f compose.test.yaml down
```

No usar `down -v` para una parada normal. No se probó recuperación de disco ni
backup/restore. Los contenedores de la entrega permanecen activos en loopback.

## Recepción y continuación

El proyecto tiene raíz Git propia y conserva su estado de archivos sin seguimiento;
no se crearon commits, remotos, publicaciones ni despliegues. No se incluyen secretos
en documentación o imágenes. No se modificaron los demás microservicios.

La recepción local debe distinguir los criterios comprobados de los bloqueados.
Para continuar hacia administración operativa hacen falta los contratos y decisiones
de [integraciones-pendientes.md](integraciones-pendientes.md) y una autorización
explícita para ese nuevo trabajo. La evaluación Azure pertenece a otra etapa.
