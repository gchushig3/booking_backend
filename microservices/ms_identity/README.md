# ms-identity — Descubre EC

Nueva integracion: [Neon, validacion Schema-First y API Keys Booking](docs/infraestructura-booking.md). Agregar BOOKING_API_KEY a los entornos existentes; Docker usa la raiz del workspace como contexto.

Estado: fase H completada, entrega técnica local de autenticación, autorización y Swagger/OpenAPI. El repositorio Git propio está en
`microservices/ms_identity`; el nombre npm es `ms-identity`.

Registro, login, refresh, sesiones, logout, verificación y recuperación funcionan
con PostgreSQL y correo Mailpit. JWT RS256 y JWKS público permiten verificar firmas.
Las cinco tablas, dominios, vista y roles originales permanecen intactos.
Bootstrap ADMIN explícito y administración RBAC ya están disponibles. Swagger
está en http://localhost:3011/api/docs, público localmente. Ver el [contrato de autenticación](docs/auth-contract.md),
el [contrato de autorización](docs/authorization-contract.md) y el [contrato JWT](docs/jwt-contract.md).

Entrega: [guía de operación local](docs/local-operations.md),
[matriz de 25 endpoints](docs/endpoints.md),
[integraciones pendientes](docs/pending-integrations.md) e [informe final H](docs/fase-h.md).
Validación global ejecutada: 111/111 pruebas en G; comprobaciones finales de H de solo lectura.

## Requisitos

Node.js 24 (>=24.9 y <25), npm 11/12, Docker Compose y PostgreSQL 16.
NestJS 12, TypeScript 6 y dependencias fijadas mediante package-lock.json.
En PowerShell usar npm.cmd si npm.ps1 está restringido.

## Docker local

Desde la raíz del proyecto:

```sh
npm run env:local
npm run keys:local
docker compose config --quiet
docker compose up -d --build --wait
docker compose ps
```

El generador solo necesita Node. Crea .env con contraseña aleatoria sin mostrarla
ni sobrescribir archivos existentes. .env.example es una plantilla no operativa.
No versionar .env, .env.test, archivos de claves ni credenciales.

| Servicio             | URL o destino local                       |
| -------------------- | ----------------------------------------- |
| Liveness             | http://localhost:3011/api/v2/health/live  |
| Readiness PostgreSQL | http://localhost:3011/api/v2/health/ready |
| PostgreSQL           | 127.0.0.1:5441, ms_identity               |
| Mailpit UI           | http://localhost:8025                     |
| SMTP de pruebas      | 127.0.0.1:1025                            |

Los puertos se publican solo en loopback. Dentro de Docker se usan postgres:5432
y mailpit:1025. Mailpit captura mensajes localmente, sin relay externo.
La imagen estable axllent/mailpit:v1.27.4 tiene volumen propio y healthcheck.

Hay red interna y bridge local. La aplicación ejecuta como usuario node, filesystem
de solo lectura, capacidades eliminadas y no-new-privileges. La imagen no contiene
.env. PostgreSQL y Mailpit usan volúmenes propios y reinicio on-failure:3.
NODE_ENV=production identifica el build; APP_ENV=local identifica este entorno local.
Esa variable no habilita ningún bootstrap ADMIN ni concede privilegios.

## Desarrollo y pruebas

```sh
npm ci
npm run env:local
npm run keys:local
docker compose up -d postgres mailpit --wait
npm run start:dev
```

Si app ya ocupa el puerto HTTP, detener ese contenedor antes de arrancar Node.

```sh
npm run lint
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run format:check
npm run test:local-stack
```

Jest + ts-jest ESM sustituyen Vitest. Las unitarias cubren configuración, DTOs,
bcrypt, firmas, rotación de claves y exclusión de DDL automático. Las e2e aisladas
cubren HTTP, errores, CORS y límites de intentos. La integración de autenticación
usa AppModule, guards, PostgreSQL y Mailpit reales, sin sustituir autenticación.
El smoke `test:local-stack` necesita Docker activo y verifica Swagger público,
assets locales, JSON/YAML válidos e idénticos a los artefactos exportados, cabecera
de correlación, login público y exigencia de JWT en rutas protegidas. No crea
usuarios; guarda docs/fase-f-evidence.json. Los informes B/C/D/E se conservan.
Los smokes históricos pueden ejecutarse con `node scripts/verify-phase-d.mjs` o
`node scripts/verify-phase-e.mjs`. El de E requiere no tener asignaciones ADMIN
previas y elimina exclusivamente sus fixtures, sin modificar cuentas existentes.

## Inicialización controlada

En un volumen PostgreSQL nuevo, el bootstrap verifica SHA256SUMS y ejecuta solo
`database/migrations/001-identity.sql` en una transacción. Nunca se ejecuta el script
global de las 16 bases. Los tres roles originales se insertan una sola vez; no se
crea un usuario ADMIN. El SQL no modifica objetos de los otros servicios.

Para un volumen existente sin objetos propios (por ejemplo, el de B):

```sh
npm ci
npm run build
npm run db:apply
```

`db:apply` lee .env y permite solo APP_ENV local/test, base Identity y PostgreSQL 16.
Verifica la huella del SQL, usa transacción y advisory lock y rechaza una base que
ya tenga objetos. Repetirlo debe fallar sin recrear tablas ni duplicar roles.
No es una reparación, no elimina datos y no es una migración incremental.
El equivalente aislado es `npm run db:apply:test` con .env.test.

## Base de pruebas aislada

```sh
npm run env:test
npm run keys:test
docker compose --env-file .env.test -f compose.test.yaml config --quiet
docker compose --env-file .env.test -f compose.test.yaml up -d --wait
```

Proyecto ms-identity-test, puerto 5442, base ms_identity_test y volumen propio.
La configuración exige NODE_ENV=test y APP_ENV=test.

```sh
npm run test:integration
npm run test:docker-bootstrap
```

La integración solo acepta loopback:5442. En un volumen nuevo, Compose aplica el SQL.
La suite C usa transacciones y rollback, incluidos errores SQL con savepoints.
Verifica las cinco tablas, tres dominios, cinco índices explícitos, restricciones,
relaciones, identidad, hashes ocultos, UUID, BIGINT, vista y trigger. Al terminar
solo quedan los tres roles, sin usuarios, sesiones ni tokens de prueba.
La suite D persiste sus fixtures para probar HTTP y concurrencia y las elimina
por ID al terminar; elimina solo sus propios mensajes de Mailpit. Requiere Mailpit
del stack local y claves de test. Usa bcrypt cost 4 y límites elevados únicamente
con APP_ENV=test; el contenedor local conserva cost 12 y límites normales.
La prueba bootstrap crea contenedores temporales aislados y comprueba inicialización,
reinicio y rollback ante un fallo en una copia temporal del SQL; limpia solo sus recursos.

Resultado C: 19 unitarias, 6 e2e y 27 de integración aprobadas (52 en total).
Ver [informe C](docs/fase-c.md) y [evidencia C](docs/fase-c-evidence.json).

Resultado D: 33 unitarias, 8 e2e y 42 de integración aprobadas (83 en total),
además del flujo real dentro de Docker. Ver [informe D](docs/fase-d.md) y
[evidencia D](docs/fase-d-evidence.json). API local: http://localhost:3011/api/v2.

## Configuración y contratos

Además de las rutas de autenticación, GET /api/v2/health/live y GET /api/v2/health/ready
son públicos y sin datos personales. Live comprueba el proceso HTTP; ready ejecuta SELECT 1 y devuelve 503
Problem Details si falla PostgreSQL. No comprueba correo ni esquema.

Se prepararon ValidationPipe global, whitelist, rechazo de campos extra,
transformación, errores seguros, correlación y logs JSON. CORS_ORIGINS acepta una
lista explícita de orígenes separados por comas; la lista vacía deshabilita CORS
del navegador. CORS no es un mecanismo de autenticación.

TypeORM registra las cinco entidades y la vista con synchronize=false, dropSchema=false
y migrationsRun=false. Las entidades también excluyen sincronización y la fábrica
rechaza DDL automático. Los dominios originales se admiten por DataSource sin cambiar
el driver global. BIGINT se conserva como string, DATE sin hora y TIMESTAMPTZ como Date.
Password y hashes tienen select=false; las respuestas se construyen con campos
explícitos y nunca contienen hashes. No hay FK externas. El trigger SQL mantiene
los timestamps de usuario. Las claves privadas quedan en .keys ignorado por Git
y Docker; Compose las monta en solo lectura. No se generan claves en cada arranque.
El bootstrap ADMIN es un comando local explícito; no concede privilegios durante
registro ni arranque del servidor. Las políticas usan los roles vigentes de la base.

Ver [decisiones aprobadas](docs/decisiones-a.md) y [reporte C](docs/fase-c.md).
Swagger /api/docs y los documentos /api/docs-json y /api/docs-yaml están disponibles.

## Parada conservando datos

```sh
docker compose down
docker compose --env-file .env.test -f compose.test.yaml down
```

No usar down -v para una parada normal. Cambiar DB_PASSWORD en .env no cambia la
contraseña de un volumen ya inicializado. No hay despliegue, Azure, Render,
publicación de imágenes ni telemetría externa. Las fases A–H de alcance local están cerradas.

## Primer ADMIN local y prueba de permisos

Con PostgreSQL y app activos, desde esta carpeta:

```sh
npm run build
npm run admin:prepare -- --email administrador@example.test
npm run admin:bootstrap
```

Reemplazar el correo por el del administrador local autorizado. `admin:prepare`
genera 32 bytes aleatorios en `.env.admin.local`, ignorado por Git/Docker; no
imprime credenciales y rechaza sobrescribir un archivo existente. Abrir ese
archivo privado en el editor para obtener ADMIN_EMAIL y ADMIN_PASSWORD; no subirlo
ni pegar su contenido en logs. En Windows conservar las ACL del usuario local.
No hay contraseñas fijas ni usuario ADMIN automático.

Bootstrap solo admite APP_ENV=local, DB Identity en localhost/127.0.0.1 y
IDENTITY_BOOTSTRAP_ENABLED=true. Repetirlo para el mismo ADMIN activo no cambia
su contraseña ni asignaciones. Rechaza promover una cuenta CLIENTE preexistente,
reactivar una cuenta o crear un segundo ADMIN. Para este último, usar la API
autenticada de roles. No se incorpora un flag de habilitación al Compose ni al
servidor: el archivo solo se lee al ejecutar el comando explícito.

1. POST `/api/v2/auth/login` con email/password del archivo privado, sin JWT previo.
2. GET `/api/v2/users` y `/api/v2/roles` con `Authorization: Bearer <access_token>`: 200.
3. Registrar un CLIENTE y obtener su JWT por login; mismas consultas: 403.
4. GET/PATCH `/api/v2/users/me` con JWT CLIENTE: acceso al perfil propio.
5. ADMIN puede asignar roles a otros usuarios y gestionar su estado. Estos cambios
   revocan sesiones afectadas; el usuario debe iniciar sesión otra vez.

Se prohíbe modificar roles propios, auto-desactivarse y perder el último ADMIN
activo. La matriz completa, DTOs y errores están en authorization-contract.md.
El usuario bootstrap mantiene verified=false hasta usar el flujo real de correo
(resend-verification/verify-email); no se simula verificación.

Resultado E: 44 unitarias, 8 e2e y 53 de integración (105 en total), además del
smoke Docker con CLI real. Ver [informe E](docs/fase-e.md) y
[evidencia E](docs/fase-e-evidence.json). La prueba elimina sus ADMIN de fixture;
el administrador permanente se crea con el procedimiento explícito anterior.

## Swagger y contrato exportable

- UI: http://localhost:3011/api/docs
- JSON: http://localhost:3011/api/docs-json
- YAML: http://localhost:3011/api/docs-yaml
- Artefactos versionables: [openapi.yaml](docs/openapi.yaml) y [openapi.json](docs/openapi.json).

Las 25 operaciones reales mantienen /api/v2; /api/docs no recibe ese prefijo.
Swagger, assets y documentos son públicos localmente. Los endpoints protegidos
conservan JWT/RBAC; un candado indica Bearer, la descripción ADMIN exige ese rol.
No se persiste el Bearer en localStorage y el validador externo de Swagger está
desactivado. Los assets se sirven desde el paquete local, sin CDN. Analítica Scarf
de instalación deshabilitada en package.json y en los stages de npm ci de Docker.

Flujo real en la interfaz:

1. Expandir POST /api/v2/auth/register, pulsar Try it out y registrar un correo
   local propio con una contraseña nueva válida; respuesta 201 y CLIENTE.
2. Expandir POST /api/v2/auth/login y ejecutar con esas credenciales, sin Authorize.
3. Copiar access_token de la respuesta real; en Authorize pegar solo ese valor.
4. Ejecutar GET /api/v2/auth/me y GET /api/v2/users/me: 200.
5. Con CLIENTE, GET /api/v2/users devuelve 403. Para probar ADMIN, crearlo con el
   procedimiento CLI anterior, iniciar sesión y reemplazar el token en Authorize.
6. Con ADMIN, GET /api/v2/users y GET /api/v2/roles devuelven 200.
7. Correo y recuperación se completan usando los tokens de Mailpit. Logout o
   cambio de roles/contraseña puede invalidar el token guardado: volver a login.

No pegar refresh_token en Authorize. Usarlo únicamente en /auth/refresh, operación
pública que valida el propio refresh. Las respuestas/errores documentan códigos,
DTOs, validaciones, IDs BIGINT string y X-Correlation-Id.

Exportar/verificar desde la carpeta del servicio, con .env local y PostgreSQL activo:

```sh
npm run build
npm run openapi:export
npm run openapi:check
```

La exportación usa el AppModule y controladores reales, sin servidor HTTP ni
solicitudes de negocio. No inicializa esquema, no crea usuarios y no genera tokens.
Valida OpenAPI 3 y rechaza referencias externas. JSON y YAML se generan de la
misma metadata; regenerar después de cambiar DTOs/endpoints y ejecutar format:check.

Verificación opcional de navegador real, con Chrome instalado y Docker activo:

```sh
npm run test:swagger-browser
```

Usa Chrome headless con perfil temporal aislado y Try it out, genera sus propias
cuentas y las elimina junto con correo, archivo de credenciales y perfil. Requiere
no tener asignaciones ADMIN previas: nunca modifica un ADMIN existente. En Windows
busca Chrome en Program Files; configurar CHROME_PATH para otra instalación.
No imprime ni guarda passwords/JWT, y los límites reales de intentos siguen activos.
La evidencia excluye valores de credenciales. Ver [informe F](docs/fase-f.md).

## Verificación global local — Fase G

```sh
npm run verify:local
```

Requiere dependencias instaladas, .env/.env.test, claves locales/de test,
PostgreSQL/Mailpit activos y Chrome (CHROME_PATH opcional). Antes de ejecutar los
smokes de bootstrap exige ausencia de asignaciones ADMIN en las bases local/de
test y una base de test sin usuarios; rechaza modificar cuentas existentes.
Si ya creaste tu ADMIN permanente, ejecuta las suites aisladas y el smoke HTTP
por separado; no elimines tu cuenta para satisfacer esa condición del automatizador.

El comando ejecuta lint, typecheck, build, formato, sincronización OpenAPI, todas
las suites Jest, bootstrap SQL en contenedores temporales, construcción Docker,
flujo administrativo y Try it out en Chrome. Reinicia únicamente los servicios
Identity para comprobar salud, conservación del estado SQL y claves públicas;
los límites de intentos y guards permanecen activos. Audita dependencias de producción.
No despliega ni publica imágenes. Elimina exclusivamente sus fixtures y archivos
temporales, conserva las evidencias históricas y escribe docs/fase-g-evidence.json.

Resultado G: **111/111 pruebas, cero omitidas**, bootstrap/rollback SQL, Docker,
JWT/RBAC y navegador aprobados; cero vulnerabilidades reportadas de producción.
Ver [informe G](docs/fase-g.md) y [evidencia G](docs/fase-g-evidence.json).
La entrega H referencia esa evidencia ejecutada y documenta el estado final sin
repetir innecesariamente las suites ni generar un administrador permanente.
