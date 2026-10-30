# Fase C — Persistencia de Identity

Fecha: 2026-10-28, America/Guayaquil. Autorización: «Vamos con la fase C».
No se inicia D ni se implementa autenticación en esta fase.

## 1. Inspección

Se releyó el bloque Identity del SQL aprobado y se revisaron AGENTS.md, configuración,
conexión TypeORM, Compose, pruebas y evidencia B. Las dos bases existentes estaban
sin esquema propio. Se conservó su volumen; no se reinicializó ni eliminó PGDATA.

## 2. Implementación

Se implementaron las entidades de rol, usuario, usuario_rol, sesion y
token_verificacion, y la vista v_usuario_roles. Sus nombres, tipos, nulabilidad,
claves, defaults, índices y relaciones corresponden al SQL v2.

Se extrajo únicamente el bloque entre la conexión ms_identity y la sección siguiente,
normalizando LF y eliminando solo el comando psql de conexión y espacios exteriores.
El archivo mantiene la semántica original, incluidos pgcrypto, tres dominios,
función, trigger, vista y seeds. No se ejecutó ni modificó el script global.

El inicializador exige huella aprobada, PostgreSQL 16 y base Identity, usa transacción
y advisory lock, y rechaza bases con objetos propios. No aplica IF NOT EXISTS a
tablas, no borra objetos ni duplica datos. No crea tabla de historial de migraciones.
El bootstrap de PostgreSQL nuevo verifica SHA256SUMS y ejecuta psql en una transacción.

TypeORM mantiene synchronize=false, dropSchema=false y migrationsRun=false. Una
fábrica por DataSource reconoce únicamente los tres dominios aprobados y rechaza
DDL automático; no cambia el driver global ni sustituye dominios por varchar.

## 3. Archivos creados o modificados

Nuevos:

- src/database/entities/: cinco entidades, vista e índice de registro.
- src/database/identity-domains.ts y apply-identity-schema.ts.
- database/migrations/001-identity.sql y SHA256SUMS.
- database/source.json, schema-manifest.json y docker-init.sh.
- scripts/apply-schema.mjs, verify-docker-bootstrap.mjs y verify-phase-c.mjs.
- test/jest-integration.config.mjs, test/integration/identity.integration-spec.ts
  y test/unit/identity-domains.spec.ts.
- docs/fase-c.md y fase-c-evidence.json.

Modificados: src/app.module.ts, src/database/database-options.ts, compose.yaml,
compose.test.yaml, package.json, test/unit/environment.spec.ts y README.md.
Las pruebas de entorno ahora verifican registro real de entidades mediante la
suite de dominios, sin esperar la lista vacía de B. La evidencia B se conserva.

No se modificaron otros microservicios, SQL maestro, contrato Booking, secretos
locales ni versiones de dependencias.

## 4. Contratos utilizados

SQL v2 como fuente estructural. El bloque extraído tiene SHA-256:

```text
84fa0e694dece975a098b4d22b725b589fb94fe0f071d8f4872740a2ddedb204
```

Se preservan SMALLINT/INTEGER como number, BIGINT como string, DATE como fecha sin
hora y TIMESTAMPTZ como Date. Sesión usa UUID generado por gen_random_uuid() en la
base. No se infieren restricciones nuevas sobre expiración, formato del hash o
transiciones: la política de autenticación corresponde a D/E.

Los campos usu_password, ses_token_hash y tokv_token tienen select=false.
El almacenamiento SHA-256 de los tokens cabe en sus VARCHAR(128), como se aprobó en A.
Los timestamps de usuario siguen controlados por la función y trigger originales.

## 5. Endpoints funcionales

Se conservan GET /api/v2/health/live y GET /api/v2/health/ready, comprobados en el
contenedor reconstruido con AppModule y entidades reales. Mailpit continúa disponible.
No se añadieron endpoints de negocio en C.

## 6. Pendientes por fase

Registro, login, refresh, verificación, recuperación y sesiones HTTP corresponden a D;
RBAC, usuarios/roles administrativos y bootstrap ADMIN a E. Swagger corresponde a F.
Las rutas no implementadas devuelven 404, sin guards provisionales que impidan
utilizar una implementación existente.

Los tres roles ya están cargados, pero no hay cuentas operativas ni administrador
por defecto. Las fixtures bcrypt/SHA-256 de integración no son usuarios reales ni
prueban los flujos de autenticación.

## 7. Comandos ejecutados

Desde ms_identity:

```sh
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:integration
npm.cmd run db:apply
npm.cmd test
npm.cmd run test:e2e
docker compose config --quiet
docker compose --env-file .env.test -f compose.test.yaml config --quiet
docker compose up -d --build --wait --wait-timeout 120
docker compose --env-file .env.test -f compose.test.yaml up -d --wait --wait-timeout 60
node scripts/verify-docker-bootstrap.mjs
node scripts/verify-phase-c.mjs
npm.cmd run format:check
```

Se ejecutó Prettier sobre los archivos modificados. La suite inicializa la base de
pruebas solo si está vacía. db:apply inicializó una vez la base local vacía de B.
No se eliminaron bases ni volúmenes. Las operaciones Docker usaron elevación
aprobada para acceder al motor local.

## 8. Resultados reales

| Comprobación                   | Resultado                                                             |
| ------------------------------ | --------------------------------------------------------------------- |
| Lint sin warnings y TypeScript | Aprobados                                                             |
| Build local y Docker           | Aprobados                                                             |
| Unitarias                      | 19 aprobadas, 2 suites                                                |
| E2E de infraestructura         | 6 aprobadas, 1 suite                                                  |
| Integración PostgreSQL real    | 27 aprobadas, 1 suite                                                 |
| Total Jest                     | 52 aprobadas, 4 suites                                                |
| Formato                        | Aprobado                                                              |
| Bootstrap Docker limpio        | Cinco tablas y tres roles, sin usuarios                               |
| Fallo SQL en copia temporal    | Rollback de tablas y dominios comprobado                              |
| Reaplicación y SQL alterado    | Rechazados en pruebas, sin duplicar seeds                             |
| Stack con entidades reales     | Salud y SMTP comprobados                                              |
| Reinicio                       | Mismo volumen, cinco tablas, tres dominios, vista y roles conservados |

Las pruebas verifican columnas/tipos/defaults/identidad ALWAYS, restricciones,
índices, relaciones, claves compuestas, BIGINT superior a MAX_SAFE_INTEGER, UUID,
hashes ocultos, fechas, vista activa, cascadas, RESTRICT, SET NULL y trigger.
Cada caso corre en transacción con rollback; los errores esperados usan savepoints.
Al terminar solo quedan los tres roles originales y cero usuarios/sesiones/tokens.

El bootstrap se probó en contenedores temporales propios; la copia de SQL de fallo
jamás sustituye la migración aprobada y la limpieza está limitada a esos recursos.
La evidencia C registra imagen, versión, instante UTC y snapshots sin credenciales.

Se corrigió un warning inicial de Oxlint sobre ordenamiento de capturas regex.
No se ocultaron fallos ni se consideraron pruebas omitidas como aprobadas.

## 9. Riesgos y límites

El soporte de dominios usa una extensión acotada de una propiedad de TypeORM 0.3;
se mantienen versiones fijadas y se requiere regresión al actualizar.

select=false protege consultas ORM por defecto, pero no sustituye DTOs de salida:
save o SQL explícito pueden devolver hashes. D/E deberán mapear respuestas seguras
y validar expiración, hash, usuario/rol activo, uso único y revocación.

El inicializador no es una reparación ni una migración incremental. Una base con
objetos se rechaza; futuros cambios necesitan SQL revisado y autorización. El
bootstrap initdb solo corre para PGDATA nuevo; volúmenes existentes requieren la
inicialización manual una vez si están vacíos de objetos.

No cambiaron dependencias. La instalación Docker volvió a informar cero avisos de
producción y seis bajos de desarrollo, sin actualizaciones forzadas.
No hubo despliegue, recursos Azure/Render, publicación de imágenes ni commits.

## 10. Autorización siguiente

Detener al finalizar C y solicitar autorización explícita para D: registro, login,
refresh, logout, verificación y recuperación con seguridad real conforme al diseño
aprobado. No avanzar a esa fase dentro de esta entrega.
