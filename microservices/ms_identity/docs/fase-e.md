# Fase E — Autorización y bootstrap ADMIN

Fecha local: 2026-10-29, America/Guayaquil. Autorización del usuario: «Vamos con la
Fase E» y «Continua con la Fase E». Se termina únicamente E; F requiere aprobación.

## 1. Inspección

Se revisaron AGENTS.md, decisiones aprobadas de A, informes D, autenticación,
entidades y SQL controlado, configuración, scripts de claves y pruebas. Los
documentos obligatorios completos se inspeccionaron en A y siguen siendo las
fuentes: flujo_trabajo.md, SQL v2 y OpenAPI externo Booking. Booking no define estas
rutas internas y su incompatibilidad YAML documentada no se modifica.

En esta sesión faltaban node_modules y .env y Docker Desktop estaba detenido.
Se restauraron dependencias desde package-lock, se inició Docker instalado y se
recuperó .env desde el contenedor existente de Identity, sin mostrar secretos,
cambiar la contraseña de PostgreSQL ni eliminar/recrear volúmenes. No se activó
telemetría de producción ni se conectó ningún servicio externo.

## 2. Implementación

- Guard RBAC después del guard JWT; usa roles activos actuales obtenidos de PostgreSQL.
- GET/PATCH de perfil propio para cualquier usuario autorizado, sin campos de privilegios.
- Consultas paginadas de usuarios, detalle y gestión de estado exclusivamente ADMIN.
- Consulta de roles y asignaciones; asignación/retiro exclusivamente ADMIN a otros usuarios.
- Identificadores BIGINT string sin pérdida y validación SMALLINT de IDs de rol.
- Cambios de roles revocan todas las sesiones afectadas; desactivación también
  invalida tokens de verificación pendientes. Reactivar no revive sesiones anteriores.
- Prohibición de editar roles propios, auto-desactivarse o perder el último ADMIN activo.
- Bloqueo transaccional compartido y revalidación del actor/sesión/ADMIN dentro
  de cada escritura administrativa; concurrencia de retiros cruzados probada.
- Bootstrap CLI explícito local, bcrypt cost 12, habilitación requerida y generación
  de contraseña aleatoria de 32 bytes sin imprimirla. No se ejecuta durante arranque HTTP.
- Idempotencia sin cambios de contraseña/asignaciones; nunca promueve una cuenta
  existente, reactiva cuentas o crea otro ADMIN si ya existe una asignación ADMIN,
  incluso si su usuario está inactivo. Producción y targets remotos rechazados.

La cuenta inicial conserva verified=false hasta verificar por correo real. Ningún
registro público asigna ADMIN. SQL, sus cinco tablas, índices, dominios, trigger,
vista, datos iniciales y synchronize=false permanecen sin cambios.

## 3. Archivos creados/modificados

Creado src/users/: users.module.ts, users.controller.ts, users.service.ts,
users.dto.ts, identity-id.pipe.ts, authorization.ts y bootstrap-admin.ts.
Modificados src/auth/auth.decorators.ts, auth.guards.ts y auth.module.ts para
integrar RBAC; app.module.ts registra UsersModule; configure-application.ts
deshabilita caché también para usuarios y roles.

Scripts nuevos: prepare-admin.mjs, bootstrap-admin.mjs y verify-phase-e.mjs.
package.json incorpora admin:prepare/admin:bootstrap y el smoke E. Sin nuevas
dependencias ni cambios de infraestructura de otros servicios.

Pruebas nuevas: test/unit/authorization.spec.ts, test/unit/admin-cli.spec.ts y
test/integration/authorization.integration-spec.ts. README, .env.example,
auth-contract.md y authorization-contract.md actualizados. Informes B/C/D intactos.
.env y archivos de credenciales permanecen ignorados; no se crean commits ni pushes.

## 4. Contratos

[Matriz de permisos, DTOs y errores](authorization-contract.md),
[autenticación](auth-contract.md) y [JWT](jwt-contract.md).
Perfil admite nombres, documento, teléfono, fecha y avatar; no email, contraseña,
roles, active o verified. Los opcionales SQL aceptan null para limpiar, nombres no.
Fechas se validan contra calendario real; URL admite HTTP/HTTPS, sin lectura remota.
Documento único duplicado devuelve 409 seguro; ID inválido/paginación/campos extra: 400.
Sin JWT: 401; válido sin rol suficiente: 403; recurso ausente: 404.

ADMIN administra globalmente; CLIENTE/OPERADOR únicamente su propio perfil.
No se deduce propiedad de operadores Catalog desde el rol OPERADOR.

## 5. Endpoints funcionales

Nueve operaciones nuevas bajo /api/v2:
GET/PATCH /users/me; GET /users; GET /users/:id;
PATCH /users/:id/status; GET /roles;
GET/POST /users/:id/roles; DELETE /users/:id/roles/:roleId.
Las 13 operaciones auth, JWKS y dos sondas D siguen funcionando.
URL local: http://localhost:3011/api/v2. Swagger todavía no se implementa.

## 6. Pendientes/bloqueos

No quedan bloqueos artificiales en las rutas E. Se obtiene un JWT ADMIN real
mediante el procedimiento de README y login; CLIENTE/OPERADOR reciben 403 donde
corresponde. Las pruebas eliminan sus cuentas ADMIN, no dejan un usuario fijo.
El usuario crea su ADMIN permanente con admin:prepare/admin:bootstrap explícitos.

F: Swagger /api/docs y exportación OpenAPI. G/H: verificación global y entrega.
Integración de consumidores, incluida actualización de Catalog, queda fuera de E.
No hay despliegue, Azure, Render, publicación de imágenes ni pipeline CD.

## 7. Comandos ejecutados

Desde microservices/ms_identity (npm.cmd en PowerShell):

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm run lint
npm run build
npm test
npm run test:e2e
npm run test:integration
docker compose up -d --build --wait
npm run test:local-stack
npm run format:check
```

También se ejecutaron Prettier sobre archivos editados, consultas de estado
Docker, SHA-256 del SQL y recuentos de limpieza PostgreSQL. El smoke ejecuta
bootstrap-admin.mjs con .env y un archivo temporal privado generado para esa
ejecución, dos veces para probar idempotencia. La preparación de credenciales se
prueba en un directorio temporal aislado; nunca imprime contraseñas.

## 8. Resultados reales

| Verificación                               | Resultado              |
| ------------------------------------------ | ---------------------- |
| TypeScript/build host y Docker             | Aprobados              |
| Oxlint sin warnings permitidos y formato   | Aprobados              |
| Jest unitarias                             | 44 / 44                |
| E2E HTTP aisladas                          | 8 / 8                  |
| Integración PostgreSQL, auth y RBAC reales | 53 / 53                |
| Total                                      | 105 pruebas, 10 suites |
| Smoke Docker E con bootstrap CLI           | Aprobado               |

Integración incluye 27 pruebas de persistencia C, 15 de autenticación D y 11 de
autorización E. No se sustituyen guards ni firma JWT en la integración. Se prueban
401/403/200, roles inactivos, documentos duplicados, DTOs, propiedad del perfil,
revocación, claims anteriores, bootstrap seguro/idempotente y retiros concurrentes.
Un error inicial en la preparación de una petición Supertest se corrigió antes
de repetir las suites; los números corresponden a ejecuciones aprobadas.

[Evidencia Docker](fase-e-evidence.json): ADMIN inicia sesión y administra;
CLIENTE y OPERADOR no administran; perfil propio funciona; cambios de rol revocan
sesión; desactivado no inicia sesión; auto-desactivación rechazada. Antes/después:
cero usuarios, tres roles, cinco tablas y tres dominios. Se eliminan únicamente
las cuentas, correo y archivo privado temporal de esa ejecución.

## 9. Riesgos y límites

- Bootstrap local no sustituye un proceso de administración de producción ni
  recupera/promueve cuentas existentes. Guardar el archivo privado local de forma segura.
- Rate limit D sigue en memoria de una instancia; SMTP y claves de producción
  requieren configuración futura aprobada. Se mantienen los límites y bcrypt normales en Docker.
- Revocación inmediata se comprueba en Identity; los consumidores offline necesitan
  acordar su política de vigencia. No se conectan automáticamente a bases ajenas.
- Docker npm ci reportó cero vulnerabilidades de producción y seis bajas de
  desarrollo ya existentes; no se aplicó audit fix --force. Jest muestra el aviso
  experimental de VM Modules sin impedir las pruebas.

## 10. Criterios y siguiente aprobación

Se cumple E: JWT y RBAC efectivos, separación de permisos, perfil propio seguro,
administración autenticada, bootstrap usable sin ADMIN predeterminado y pruebas
de accesos permitidos/denegados y concurrencia. No se cambia SQL ni otro servicio.
Se detiene antes de F. Solicitud siguiente: autorizar Fase F — Swagger/OpenAPI.
