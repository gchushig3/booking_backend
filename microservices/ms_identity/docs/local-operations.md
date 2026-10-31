# Operación local y transferencia de ms-identity

Directorio del repositorio independiente: microservices/ms_identity. Ejecutar los
comandos desde esa carpeta. Nombre npm: ms-identity. En PowerShell usar npm.cmd
si la política bloquea npm.ps1. Requisitos: Node 24 >=24.9 y <25, npm 11/12 y Docker.

## Arranque desde una copia limpia

```sh
npm ci
npm run env:local
npm run keys:local
docker compose config --quiet
docker compose up -d --build --wait
docker compose ps
```

npm ci instala las versiones del lockfile y permite usar comandos administrativos,
exportación y pruebas desde host. El Dockerfile realiza además su propia instalación.
El generador .env crea contraseña aleatoria y no sobrescribe un archivo existente;
el de claves crea RSA 3072 persistente y conserva un keyring existente.
.env.example es una plantilla; no contiene una contraseña utilizable.

En un volumen nuevo, PostgreSQL 16 verifica el checksum y aplica únicamente
database/migrations/001-identity.sql de forma transaccional. Se crean las cinco
tablas, tres dominios, vista, restricciones, índices, trigger y tres roles originales.
No se ejecuta el SQL global de 16 bases. No hay usuario ADMIN automático.

| Recurso              | Dirección local                                     |
| -------------------- | --------------------------------------------------- |
| Swagger              | http://localhost:3011/api/docs                      |
| OpenAPI JSON / YAML  | http://localhost:3011/api/docs-json / api/docs-yaml |
| Liveness             | http://localhost:3011/api/v2/health/live            |
| Readiness PostgreSQL | http://localhost:3011/api/v2/health/ready           |
| JWKS                 | http://localhost:3011/api/v2/.well-known/jwks.json  |
| Mailpit UI / SMTP    | http://localhost:8025 / 127.0.0.1:1025              |
| PostgreSQL principal | 127.0.0.1:5441, ms_identity                         |
| PostgreSQL test      | 127.0.0.1:5442, ms_identity_test                    |

## Primer administrador

Con PostgreSQL activo y dependencias host instaladas:

```sh
npm run build
npm run admin:prepare -- --email administrador@example.test
npm run admin:bootstrap
```

Sustituir el correo por el del administrador local autorizado. El primer comando
de preparación crea .env.admin.local con contraseña aleatoria; leer ese archivo
privado en el editor, sin imprimirlo ni versionarlo. No sobrescribe credenciales.
Usar ADMIN_EMAIL/ADMIN_PASSWORD en POST /api/v2/auth/login, sin Authorization previo.
Copiar access_token real en Authorize y ejecutar GET /users o GET /roles (prefijo /api/v2).

El bootstrap exige habilitación explícita en ese archivo, APP_ENV=local y destino
loopback. Es idempotente para el mismo ADMIN activo, sin cambiar contraseña.
Rechaza promover un CLIENTE existente, reactivar cuentas o crear otro ADMIN si
ya existe una asignación ADMIN. El segundo se asigna con la API autenticada a un
usuario registrado. No existe una ruta pública de promoción. La verificación
del correo del administrador usa resend-verification y verify-email, como cualquier
cuenta, manteniendo verified=false hasta completarla.

## Uso de la API y correo

Registrar un CLIENTE desde Swagger, iniciar sesión sin JWT previo y usar su access
en /auth/me y /users/me. En administración obtiene 403; con ADMIN obtiene acceso.
El correo de registro/recuperación se captura realmente en Mailpit. Copiar solo el
token del mensaje al DTO correspondiente, nunca un JWT en lugar de token opaco.
Refresh recibe refresh_token en cuerpo y no exige access; reemplazar ambos tokens
tras renovar y serializar renovaciones. Cambiar contraseña/roles o cerrar sesión
puede invalidar tokens guardados en Swagger: iniciar sesión otra vez.

Las respuestas de error son Problem Details y devuelven X-Correlation-Id. Swagger
no persiste el Bearer en localStorage. Usuario y roles inactivos no conceden acceso.
No se modifica la propiedad de recursos Catalog desde Identity.

## Configuración: host y contenedor

.env configura Node en host y proporciona valores que Compose interpola de forma
explícita; Compose no carga automáticamente todas sus variables dentro de app.

| Parámetro                               | Node en host                             | App Docker actual                                                    |
| --------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| NODE_ENV / APP_ENV                      | Valores .env                             | production / local                                                   |
| DB_HOST / DB_PORT                       | 127.0.0.1 / 5441                         | postgres / 5432                                                      |
| DB_DATABASE                             | ms_identity                              | ms_identity                                                          |
| Neon DATABASE_URL                       | Base de datos db_identity o ms_identity | Base de datos db_identity o ms_identity                              |
| DB_USERNAME / DB_PASSWORD               | .env local                               | Se transmiten desde .env                                             |
| SMTP_HOST / SMTP_PORT                   | 127.0.0.1 / 1025                         | mailpit / 1025                                                       |
| PORT / SMTP_FROM / CORS_ORIGINS         | .env o valores predeterminados           | Se transmiten desde .env                                             |
| JWT_KEYRING_PATH                        | .keys/identity.local.json predeterminado | /run/identity-keys/identity.local.json                               |
| JWT_KEYRING_JSON                        | No configurado                           | Secreto alternativo a JWT_KEYRING_PATH                               |
| JWT_ISSUER / TTL / bcrypt / rate limits | Configurables mediante .env              | Predeterminados de AuthSettings; Compose no transmite esos overrides |

Predeterminados aprobados: issuer urn:descubreec:identity, access 900 segundos,
sesión absoluta siete días, bcrypt cost 12, login 5/min, recovery 3/15min y refresh
30/min. Para personalizar Docker hace falta configurar explícitamente environment
de Compose y coordinar el contrato, respetando las validaciones de AuthSettings.
APP_ENV identifica el alcance; por defecto sigue NODE_ENV (production -> production),
pero Compose local lo establece explícitamente a local. En producción, SMTP requiere
credenciales SMTP y TLS (implicit TLS en puerto 465 o STARTTLS en otros puertos).
Configure `SMTP_USER` y `SMTP_PASS` como secretos; el transporte autenticado usa
ambos en Nodemailer.

No copiar .env, .env.test, .env.admin.local o .keys a Git, imagen, logs o paquetes
de entrega compartidos. Mantener las ACL del usuario local en Windows. Los archivos
ejemplo/documentos y claves públicas JWKS sí son distribuibles sin secretos.

## Inicialización y conservación de datos

Para un volumen existente realmente vacío, npm run build y npm run db:apply
verifican checksum, base/versión y ausencia de objetos, aplicando una única
transacción con lock. db:apply:test es el equivalente aislado. Una base ya
inicializada se rechaza sin recrear objetos ni duplicar roles. Es inicialización,
no una migración incremental ni reparación. TypeORM nunca sincroniza el esquema.

```sh
docker compose down
docker compose --env-file .env.test -f compose.test.yaml down
```

Estas paradas conservan volúmenes; no usar down -v para una parada normal. Cambiar
DB_PASSWORD en .env no cambia la contraseña de un volumen ya creado. Conservar
también .keys fuera de Git: el volumen SQL por sí solo no preserva firmas JWT.

## Pruebas y contrato exportable

```sh
npm run env:test
npm run keys:test
docker compose up -d postgres mailpit --wait
docker compose --env-file .env.test -f compose.test.yaml up -d --wait
npm run lint
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run test:integration
npm run openapi:check
npm run format:check
```

Regenerar documentos después de cambios contractuales con npm run openapi:export.
Requiere dependencias host, build y PostgreSQL local; no crea usuarios ni esquema.
Jest de integración usa exclusivamente loopback:5442, base aislada y Mailpit real;
limpia sus cuentas/mensajes. No usar la base de test para cuentas permanentes.

npm run verify:local reproduce G, incluidos bootstrap SQL aislado, Docker y Chrome.
Requiere ausencia de ADMIN previo en ambas bases para probar el primer bootstrap,
y test sin usuarios. Si hay un ADMIN permanente local, usar las suites aisladas y
npm run test:local-stack por separado; nunca borrar cuentas reales por esa condición.
La verificación global reinicia los servicios Identity y elimina solo sus fixtures.

## Diagnóstico local

| Resultado                | Comprobación                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| 401 en protegido         | Access correcto, firma/expiración y sesión vigentes; refresh no sirve como Bearer          |
| 403                      | Rol activo insuficiente o edición de roles propios; verificar con /auth/me                 |
| 409 al registrar/asignar | Correo/documento/rol duplicados o restricción de administración documentada                |
| 429                      | Esperar Retry-After; no desactivar guards ni límites                                       |
| 400 en token opaco       | Usado, vencido, propósito incorrecto o formato inválido                                    |
| readiness 503            | Salud/conexión PostgreSQL y configuración de su volumen                                    |
| Correo no recibido       | Salud Mailpit y verification_email_sent; solicitar reenvío si corresponde                  |
| App no inicia            | .env válido, PostgreSQL listo y archivo de claves montado, sin regenerarlo arbitrariamente |

Problemas de integración con otros servicios se gestionan según
[pendientes de integración](pending-integrations.md), sin acceder a sus bases.
