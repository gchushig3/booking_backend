# Fase B — Proyecto y Docker local

Fecha de cierre: 2026-10-28, America/Guayaquil. Autorizaciones: «Vamos con la fase B»
y «Retoma la Fase B». Se retomaron los cambios existentes sin reiniciar el trabajo.
No se inicia C.

## 1. Inspección

Se revisaron AGENTS.md, código base, tsconfig, scripts, lockfile, Vitest y estado
Git. Los documentos obligatorios se leyeron completamente en A. El proyecto tenía
solo el ejemplo Hello World, sin Docker ni conexión PostgreSQL. No existe producción
que requiera Observe; no se instaló telemetría externa.

## 2. Implementación

- Proyecto existente renombrado a ms-identity en package.json/lockfile, preservando
  su directorio y repositorio Git propios.
- Migración de Vitest a Jest, ts-jest ESM y Supertest; eliminación del script deploy
  y dependencias de despliegue/Vitest que ya no se usan.
- Configuración de Node 24, TypeScript 6, NestJS 12, variables validadas y entornos
  local/test separados. Scripts de generación de contraseñas aleatorias sin sobrescritura.
- Conexión real TypeORM/PostgreSQL con entities=[], synchronize=false,
  dropSchema=false y migrationsRun=false; no entidades ni DDL de negocio.
- Sondas HTTP, validación global, CORS con lista explícita, correlación,
  Problem Details y logs JSON sin detalles de errores internos en las respuestas.
- Dockerfile multietapa, usuario node, filesystem de aplicación de solo lectura,
  capacidades eliminadas, no-new-privileges y secretos excluidos de la imagen.
- Compose con PostgreSQL 16 y Mailpit local, volúmenes persistentes, healthchecks,
  red interna/bridge local, puertos loopback y reinicio controlado.
- Compose PostgreSQL de pruebas aislado, sin ejecutar el esquema de C.

## 3. Archivos

Nuevos: Dockerfile, .dockerignore, .env.example, .nvmrc, compose.yaml,
compose.test.yaml, jest.config.mjs, scripts/prepare-local-env.mjs,
scripts/verify-phase-b.mjs, src/config/environment.ts,
src/database/database-options.ts, src/health/health.controller.ts,
src/common/problem-details.filter.ts, src/configure-application.ts,
test/jest-e2e.config.mjs, test/unit/environment.spec.ts, test/health.e2e-spec.ts,
docs/decisiones-a.md, docs/fase-b.md y docs/fase-b-evidence.json.

Modificados: package.json, package-lock.json, tsconfig.json, src/app.module.ts,
src/main.ts, .gitignore y README.md. Se conservó Oxlint y se exige cero warnings.
Se retiraron los archivos de configuración Vitest y el controlador/servicio/tests
Hello World. .env y .env.test fueron generados localmente, están ignorados y sus
valores no se muestran ni se incluyen en los entregables Git.

## 4. Contratos utilizados

Se conserva el diseño aprobado de A, registrado en decisiones-a.md, sin crear
columnas, tablas o integraciones ficticias. La futura extracción de SQL se limita
a Identity. El SQL original y el contrato Booking no se modificaron.

Las sondas técnicas adicionales de B son:

| Método y ruta            | Respuesta                                         | Acceso  |
| ------------------------ | ------------------------------------------------- | ------- |
| GET /api/v2/health/live  | 200, status UP                                    | Público |
| GET /api/v2/health/ready | 200 con PostgreSQL; 503 Problem Details al fallar | Público |

Live comprueba el proceso; ready usa SELECT 1, no verifica tablas, SMTP ni roles.
X-Correlation-Id se propaga o genera. CORS no es autenticación: un origen no
permitido no recibe autorización CORS, aunque una llamada HTTP directa sea pública.

## 5. Endpoints funcionales

Las dos sondas se probaron por HTTP en tests y en Docker con AppModule/TypeORM reales.
Mailpit UI se verificó en http://localhost:8025. La recepción SMTP se comprobó con
un mensaje de infraestructura que se capturó y eliminó por su ID explícito.
No se enviaron mensajes fuera de Mailpit ni tokens de autenticación ficticios.

## 6. Endpoints pendientes

Auth, users, roles, JWT/JWKS, verificación, recuperación y bootstrap ADMIN quedan
para D/E. Swagger /api/docs corresponde a F. No existen rutas que siempre rechacen
credenciales por un guard provisional: las rutas no implementadas devuelven 404.

C implementará las cinco tablas, dominios, índices, trigger, vista y seeds.
Las bases actuales están vacías de objetos de negocio, como corresponde a B.

## 7. Comandos ejecutados

Desde microservices/ms_identity, usando npm.cmd en PowerShell:

```sh
npm.cmd install --ignore-scripts --no-audit --no-fund
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
npm.cmd run env:local
npm.cmd run env:test
docker compose config --quiet
docker compose --env-file .env.test -f compose.test.yaml config --quiet
docker compose up -d --build --wait --wait-timeout 120
docker compose --env-file .env.test -f compose.test.yaml up -d --wait --wait-timeout 60
node scripts/verify-phase-b.mjs
npm.cmd audit --json
npm.cmd audit --omit=dev --json
npm.cmd run format:check
```

También se ejecutaron Prettier, consultas SQL de lectura con pg, inspección del
contrato API real de Mailpit y comprobaciones de Git/secretos. El smoke test ejecuta
un reinicio de los tres servicios Identity y verifica nuevamente sus healthchecks.
La instalación npm inicial interrumpida falló por permisos de red/cache del sandbox;
se completó mediante ejecución elevada aprobada. Docker también requirió elevación.
No se cambió ExecutionPolicy ni configuración Git global.

## 8. Resultados reales

| Comprobación                   | Resultado                                             |
| ------------------------------ | ----------------------------------------------------- |
| Oxlint con --deny-warnings     | Aprobado                                              |
| TypeScript                     | Aprobado                                              |
| Build local y Docker           | Aprobados                                             |
| Unitarias Jest                 | 15 aprobadas, 1 suite                                 |
| E2E HTTP con doble de conexión | 6 aprobadas, 1 suite                                  |
| Total Jest                     | 21 aprobadas, 2 suites                                |
| Formato Prettier               | Aprobado                                              |
| PostgreSQL principal real      | 16.15, ms_identity, cero tablas y dominios propios    |
| PostgreSQL aislado real        | 16.15, ms_identity_test, cero tablas propias          |
| Mailpit                        | UI y SMTP comprobados; fixture eliminada              |
| Reinicio del stack             | Salud recuperada, mismo volumen y base sin DDL        |
| npm audit producción           | Cero avisos en la consulta ejecutada                  |
| npm audit con desarrollo       | Seis avisos bajos en la cadena Jest/deepmerge/ts-jest |

La imagen usa Node 24.22.2; host Node 24.21.0 y npm 12.2.0.
La evidencia JSON registra instante UTC, ID de imagen y snapshots de la base.
No se afirma que haya pruebas de entidades, roles o autenticación ejecutadas.
Las dependencias no se actualizaron mediante audit fix --force.

Se corrigieron dos warnings iniciales de conversión de unknown a string en la
validación de entorno. El primer smoke SMTP usó una ruta de borrado incorrecta:
se contrastó el contrato real de Mailpit y se cambió a DELETE /api/v1/messages con
un arreglo de un ID. La fixture de aquel intento también se eliminó de forma
individual. La verificación completa final pasó.

## 9. Riesgos y pendientes

No hay esquema, roles, usuarios ni autenticación todavía. No deben usarse estas
sondas como evidencia de que el servicio de negocio esté terminado.
El usuario PostgreSQL es de bootstrap local; los privilegios de producción requieren
una etapa posterior. Mailpit captura correos locales sin proveedor externo.

Los avisos bajos de desarrollo quedan registrados sin cambios forzados de versiones.
La adaptación de dominios TypeORM, claves JWT y bootstrap se implementará y probará
en sus fases. No se crearon commits, remotos ni publicaciones. Los otros servicios
no se modificaron. Los servicios Identity principal y de pruebas quedan activos.

## 10. Autorización siguiente

Solicitar aprobación explícita para C: entidades, extracción controlada del SQL
Identity, inicialización, seeds y pruebas reales de persistencia. No avanzar a D/E
ni implementar rutas administrativas en esta fase. No realizar despliegue.
