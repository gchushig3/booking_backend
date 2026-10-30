# Fase D — Autenticación local

Fecha local: 2026-10-28, America/Guayaquil. Autorización: «Vamos con la fase D».
Se completa únicamente D; E requiere aprobación. No se despliega ni se modifica
ningún otro microservicio. Evidencia Docker: [fase-d-evidence.json](fase-d-evidence.json).

## 1. Inspección

Se retomaron las decisiones aprobadas de A y los resultados B/C, configuración,
entidades, scripts SQL controlados, pruebas, Docker y AGENTS.md del servicio.
Los documentos obligatorios se leyeron en A: flujo_trabajo.md, SQL v2 y OpenAPI
externo de Booking. Se conserva su jerarquía: SQL define persistencia; Booking no
define estas rutas internas. La incompatibilidad YAML de Booking por claves
duplicadas en TimeSlotItem sigue documentada en decisiones-a.md, sin modificar el original.
No se activa telemetría externa: AGENTS.md se refiere a datos de producción y este
trabajo se limita al entorno local.

## 2. Implementación y decisiones

- Registro real, solo CLIENTE; bcrypt cost 12 local y DTOs que rechazan privilegios extras.
- Login público; verificación criptográfica RS256, JWKS público y claves persistentes RSA 3072.
- Guard global con @Public aplicado a rutas aprobadas y sondas; el resto requiere access válido.
- Sesiones PostgreSQL, refresh firmado con hash SHA-256, rotación bajo bloqueo transaccional.
- Reutilización firmada de refresh revoca la sesión con commit antes del 401.
- Logout individual/global, listado y revocación de sesiones únicamente propias.
- Verificación/reenvío y recuperación de contraseña con correo realmente entregado a Mailpit.
- Tokens opacos aleatorios de un uso, hash SHA-256, vencimiento y consumo atómico.
- Cambio/restablecimiento de contraseña revoca sesiones y recuperaciones pendientes.
- Se valida usuario/sesión/roles activos en cada petición protegida, además de firma y expiración.
- Respuestas explícitas sin hashes, caché deshabilitada en auth, errores Problem Details,
  X-Correlation-Id y límites temporales por ruta, IP y correo normalizado.
- No se cambia SQL ni se añaden tablas, dominios, migraciones o FK externas.

El transporte SMTP de esta fase es expresamente local; APP_ENV=production falla
al inicializarlo hasta acordar configuración de producción. Docker usa build
NODE_ENV=production y APP_ENV=local, por lo que el entorno aprobado funciona.

## 3. Archivos creados o modificados

Creado `src/auth/`: auth.module.ts, auth.controller.ts, auth.service.ts,
auth.guards.ts, auth.decorators.ts, auth.dto.ts, auth.settings.ts, jwt.service.ts,
password.service.ts y mail.service.ts.

Modificados src/app.module.ts, src/configure-application.ts,
src/health/health.controller.ts y src/common/problem-details.filter.ts para
integrar autenticación, rutas públicas, caché y respuesta segura ante indisponibilidad.

Creado scripts/prepare-local-keys.mjs y scripts/verify-phase-d.mjs. Actualizados
package.json y package-lock.json con jose, bcrypt, nodemailer y tipos, comandos
de claves y smoke de D. Compose monta las claves locales en solo lectura;
.env.example documenta parámetros. No se incluyen claves privadas en la imagen.
Los keyrings generados en .keys son locales y están ignorados, al igual que .env.

Creados test/unit/auth.spec.ts, test/auth-rate.e2e-spec.ts y
test/integration/auth.integration-spec.ts. Actualizados README y documentación D;
los informes B/C se preservan. No se crearon commits ni publicaciones remotas.

## 4. Contratos utilizados

Ver [matriz, DTOs, respuestas y permisos](auth-contract.md) y [contrato JWT](jwt-contract.md).
Issuer urn:descubreec:identity, audience access urn:descubreec:internal-api,
audience refresh urn:descubreec:identity:refresh. Access 900 segundos por defecto,
sesión absoluta siete días; sub BIGINT string, sid/jti UUID. Verificación exige
typ distinto para access/refresh. Tokens de correo 24h y recuperación 15 minutos.
Hash de 64 caracteres compatible con VARCHAR(128), sin alterar su semántica SQL.

Se conserva la huella de 001-identity.sql:
`84fa0e694dece975a098b4d22b725b589fb94fe0f071d8f4872740a2ddedb204`.

## 5. Endpoints funcionales

13 operaciones /api/v2/auth: register, login, refresh, verify-email,
resend-verification, forgot-password, reset-password, me, logout, logout-all,
sessions (GET), sessions/:id (DELETE) y change-password (PATCH).
También GET /api/v2/.well-known/jwks.json y las dos sondas de salud.
La matriz detalla método, acceso y respuesta. Públicos funcionan sin Authorization;
protegidos funcionan con el access obtenido por login real.

## 6. Pendientes y bloqueos

No queda un bloqueo artificial de acceso en las rutas de autenticación implementadas.
Sin token/inválido/expirado o sesión revocada: 401; sin algún rol activo: 403;
con credenciales válidas y permisos: respuesta exitosa. No hay guards permisivos
ni desactivación global de seguridad.

E: usuarios, políticas RBAC administrativas, matriz ADMIN/OPERADOR/CLIENTE,
bootstrap ADMIN seguro y pruebas de acceso ADMIN/CLIENTE. No hay ADMIN por defecto.
F: Swagger /api/docs y OpenAPI exportable. G/H: validación global y entrega local.
Estas rutas futuras no están implementadas todavía; no se anuncian como operativas.
La integración de consumidores, incluido Catalog, requiere su trabajo autorizado
posterior. Aquí se entrega el contrato JWT, sin tocar sus bases ni guards.

## 7. Comandos ejecutados

Desde microservices/ms_identity, usando npm.cmd en PowerShell:

```sh
npm install --save-exact jose@6.2.13 bcrypt@6.0.0 nodemailer@10.2.1 --ignore-scripts --no-audit --no-fund
npm install --save-dev --save-exact @types/bcrypt@6.0.0 @types/nodemailer@8.0.2 --ignore-scripts --no-audit --no-fund
npm run keys:local
npm run keys:test
npm run lint
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run test:integration
docker compose config --quiet
docker compose up -d --build --wait
npm run test:local-stack
docker compose ps
docker compose --env-file .env.test -f compose.test.yaml ps
```

También se ejecutó Prettier sobre archivos editados y format:check, se verificó
SHA-256 del SQL y se inspeccionó git status con safe.directory limitado al comando.
El smoke reinicia únicamente app de Identity y elimina exclusivamente su cuenta
de prueba y correo. No ejecuta el SQL global ni elimina volúmenes.

## 8. Resultados reales

| Verificación                                          | Resultado final          |
| ----------------------------------------------------- | ------------------------ |
| TypeScript typecheck                                  | Aprobado                 |
| Build NestJS host y Docker                            | Aprobado                 |
| Oxlint, sin warnings permitidos                       | Aprobado                 |
| Unitarias Jest                                        | 33 / 33                  |
| E2E HTTP aisladas                                     | 8 / 8                    |
| Integración PostgreSQL + autenticación HTTP/SMTP real | 42 / 42                  |
| Total Jest                                            | 83 / 83, siete suites    |
| Compose y flujo Docker real                           | Aprobado, evidencia JSON |

Las 42 de integración incluyen 27 de persistencia de C y 15 de autenticación de D.
La autenticación de integración utiliza AppModule, servicios, firma y guards reales.
Las pruebas aisladas de HTTP/rate limit sí declaran su controlador/doble técnico.
No se sustituyen guards en la suite real. Bcrypt cost 4 y límites elevados se
habilitan solo en el proceso de test, con APP_ENV=test y base aislada loopback:5442.

Se comprobaron datos persistidos, hashes, rechazo de campos administrativos,
login público, 401/403, issuer/audience/tipo, token expirado, sesión expirada,
usuario/rol inactivo, revocación, sesiones ajenas, replay/concurrencia de refresh,
correo real, tokens usados/reemplazados/expirados, recuperación concurrente,
cambio de contraseña y permanencia tras reinicio. Rotación de claves se verifica
con dos pares RSA reales en un directorio temporal, sin rotar las claves locales.

Docker final: app, PostgreSQL principal, Mailpit y PostgreSQL de test saludables.
Node v24.22.2 y PostgreSQL 16.15. App como node, rootfs y key mount de solo lectura.
Antes y después del smoke principal: cinco tablas, tres dominios, tres roles,
vista presente y cero usuarios; las fixtures no quedan como cuentas reales.
No se guardan access/refresh/tokens de correo ni credenciales en la evidencia.

## 9. Riesgos y decisiones pendientes

- Rate limit en memoria de una instancia; requiere contrato compartido antes de escalar.
- SMTP local síncrono sin outbox ni garantía de tiempo constante de recuperación;
  mensajes externos genéricos y reenvío disponible si una entrega falla.
- Registro duplicado 409 sigue siendo una excepción aprobada a no enumeración.
- Los clientes deben serializar refresh: el replay concurrente revoca la sesión ganadora.
- Verificación offline en otros servicios no asegura revocación inmediata; acordar vigencia.
- Claves y correo de producción no configurados; no hay despliegue ni recursos externos.
- npm ci en Docker reportó cero vulnerabilidades de producción y seis bajas de
  desarrollo ya presentes (cadena Jest/deepmerge). No se aplicó audit fix --force.
- Jest muestra el aviso experimental de VM Modules de Node; las pruebas finalizaron correctamente.

## 10. Criterios y siguiente aprobación

Se cumple el flujo completo de autenticación D con persistencia y correo reales,
separación pública/protegida, expiración, revocación, seguridad de hashes y
pruebas reproducibles. README, matriz y contrato JWT describen el comportamiento
implementado. No hay modificaciones al SQL original ni a otros microservicios.

Se detiene el trabajo antes de E, conforme al flujo por fases del usuario.
Siguiente aprobación solicitada: Fase E — Autorización y bootstrap ADMIN seguro.
