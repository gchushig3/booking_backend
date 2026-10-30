# Fase H — Entrega técnica local de ms-identity

Fecha local: 2026-10-29, America/Guayaquil. Autorización: «Vamos con la Fase H».
Se cierra la secuencia A–H del microservicio Identity para ejecución local.

## 1. Inspección final

Se revisaron AGENTS.md, README, .env.example, exclusiones Git/Docker, Dockerfile,
Compose, contratos auth/RBAC/JWT, bootstrap ADMIN, configuración, documentación y
evidencias de G. La raíz Git propia se confirmó en microservices/ms_identity;
nombre npm ms-identity. No se realizaron commits ni pushes.

Fuentes obligatorias leídas completamente en A y respetadas durante la ejecución:
flujo_trabajo.md, SQL v2 y OpenAPI externo Booking. La incompatibilidad YAML externa
identificada en A permanece documentada, sin cambiar el original.

## 2. Trabajo y resultado entregado

Servicio NestJS modular local con las cinco tablas originales, TypeORM sin
sincronización, registro CLIENTE, login y JWT RS256 reales, sesiones/refresh,
logout, verificación/recuperación por Mailpit, JWT guards/RBAC, perfiles y
administración de usuarios/roles, bootstrap ADMIN seguro, Swagger/OpenAPI y Docker.

Se consolidaron la guía de operación, matriz completa de endpoints e integraciones
pendientes. La guía diferencia variables host y environment explícito de Compose:
no se presupone que toda variable .env se transmite al contenedor. Los valores
Docker predeterminados aprobados y comprobados en G se mantienen intactos.
H no modifica código de aplicación, dependencias, esquema o contratos.

## 3. Archivos de esta fase

- README.md: estado final e índice de entrega.
- docs/local-operations.md: instalación, ADMIN, configuración, inicialización SQL,
  pruebas, conservación de datos y diagnóstico.
- docs/endpoints.md: matriz de las 25 operaciones generada desde OpenAPI.
- docs/pending-integrations.md: responsables y decisiones posteriores.
- docs/fase-h-evidence.json: comprobaciones finales de solo lectura.
- docs/fase-h.md: este reporte de cierre.

### Inventario técnico recibido

| Entregable                       | Ubicación                                                                 |
| -------------------------------- | ------------------------------------------------------------------------- |
| Configuración y aplicación       | src/main.ts, app.module.ts, configure-application.ts, config/             |
| Autenticación y sesiones         | src/auth/                                                                 |
| Usuarios, roles y bootstrap      | src/users/ y scripts/bootstrap-admin.mjs                                  |
| Entidades/dominios/vista         | src/database/                                                             |
| SQL controlado y checksum        | database/migrations/001-identity.sql y SHA256SUMS                         |
| Contratos y permisos             | docs/auth-contract.md, authorization-contract.md, jwt-contract.md         |
| OpenAPI exportable               | docs/openapi.json y docs/openapi.yaml                                     |
| Swagger y respuestas             | src/openapi/                                                              |
| Pruebas                          | test/unit/, test/integration/ y test/\*.e2e-spec.ts                       |
| Docker local                     | Dockerfile, .dockerignore, compose.yaml y compose.test.yaml               |
| Variables sin secretos           | .env.example                                                              |
| Generación local segura          | scripts/prepare-local-env.mjs, prepare-local-keys.mjs y prepare-admin.mjs |
| Verificación global reproducible | npm run verify:local y scripts/verify-phase-g.mjs                         |
| Evidencia ejecutada              | docs/fase-g-evidence.json y docs/fase-h-evidence.json                     |

## 4. Contratos preservados

REST /api/v2, Swagger /api/docs, OpenAPI 3.0.0 y aplicación independiente con
PostgreSQL 16. Son 13 operaciones auth, nueve de usuarios/roles, JWKS y dos sondas.
DTOs/restricciones/permisos están en los contratos y en la matriz final.
Errores Problem Details, X-Correlation-Id, BIGINT string y roles activos comprobados.

JWT: RS256/RSA 3072, issuer urn:descubreec:identity, audience access
urn:descubreec:internal-api, refresh urn:descubreec:identity:refresh. sub string,
sid/jti UUID, access de 900s y sesión absoluta de siete días por defecto.
Contraseñas bcrypt, refresh y tokens opacos persistidos como hashes conforme al
contrato. Sin secretos en imagen, Swagger ni artefactos de evidencia.

## 5. Funcionamiento y acceso

Swagger: http://localhost:3011/api/docs.
Mailpit: http://localhost:8025. Contratos: /api/docs-json y /api/docs-yaml.
El README y la guía explican register/login sin JWT previo, Authorize con access,
auth/me y users/me, CLIENTE 403 y ADMIN 200 en administración. La cuenta ADMIN
permanente se crea explícitamente con admin:prepare/admin:bootstrap, usando correo
elegido por el responsable. No se crea una cuenta fija durante esta entrega.

Las credenciales locales y claves privadas existentes quedan fuera de Git/Docker.
Se confirmó que Git solo versiona .env.example entre los patrones inspeccionados;
.env, .env.test, .env.admin.local y ambos keyrings se ignoran. No se leen/imprimen
credenciales para redactar el informe. La aplicación y sus pruebas funcionan con
los mecanismos de autenticación efectivos, no con guards permisivos.

## 6. Pendientes y bloqueos

No quedan bloqueos locales en las funcionalidades entregadas. Las conexiones con
Catalog y otros consumidores requieren trabajo autorizado propio: entregar un
contrato JWT no cambia automáticamente sus guards ni sus políticas de propiedad.
No se consultan bases ajenas ni se agregan FK externas.

Pendientes explícitos: política de vigencia de consumidores offline, transporte
de correo y custodia/rotación de claves de producción, límites compartidos para
varias instancias, operación/telemetría y cualquier contrato de eventos futuro.
Listado completo en pending-integrations.md. Producción/infraestructura requieren
una fase independiente; Azure se evaluará posteriormente. No se realizó despliegue.

## 7. Comandos ejecutados en H

Desde la raíz del servicio, npm.cmd en PowerShell:

```sh
docker compose ps
docker compose --env-file .env.test -f compose.test.yaml ps
npm run openapi:check
git diff --check
git check-ignore .env .env.test .env.admin.local .keys/identity.local.json .keys/identity.test.json
npm run format:check
```

Se usó safe.directory limitado a cada comando Git. También inspección de raíz Git,
archivos versionados por patrones de secretos, solicitudes HTTP de lectura/DTO
inválido, JWKS, recuentos PostgreSQL y checksum SQL. El login de DTO vacío solo
verifica su validación pública: no crea usuario ni sesión. No se ejecutaron
migraciones, bootstrap permanente, rotación de claves, borrados de datos o despliegues.

## 8. Resultados y evidencia

| Verificación                           | Resultado y alcance                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| Pruebas completas ejecutadas en G      | 111/111: 44 unitarias, 8 e2e, 59 de integración; 11 suites, cero omitidas        |
| Calidad/build/Docker/rollback SQL en G | Aprobados; evidencia G preservada                                                |
| Auditoría de producción ejecutada en G | Cero vulnerabilidades reportadas                                                 |
| Bootstrap/RBAC/Try it out en G         | ADMIN/CLIENTE/OPERADOR y navegador reales aprobados                              |
| OpenAPI en H                           | JSON/YAML válidos y sincronizados                                                |
| Salud/docs en H                        | live, ready, Swagger, JSON y YAML: 200                                           |
| Protección sin JWT en H                | auth/me, users y roles: 401 Problem Details                                      |
| Login público con DTO inválido en H    | 400, sin exigir un JWT previo                                                    |
| Correlación en H                       | X-Correlation-Id propagado                                                       |
| JWKS en H                              | Solo seis parámetros públicos RSA por clave, mínimo 3072 bits                    |
| PostgreSQL principal en H              | 16.15, cinco tablas, tres dominios, vista presente y tres roles activos          |
| Limpieza principal en H                | Cero usuarios/sesiones/tokens/asignaciones; no hay cuentas ficticias permanentes |
| Docker final                           | App, PostgreSQL, Mailpit y PostgreSQL de test saludables                         |

H no vuelve a declarar las suites como recién ejecutadas: referencia explícitamente
el resultado G de la fase inmediatamente anterior. Sus controles finales están en
[fase-h-evidence.json](fase-h-evidence.json). El servicio no cambió durante H.
Huella del SQL controlado intacta:
84fa0e694dece975a098b4d22b725b589fb94fe0f071d8f4872740a2ddedb204.

## 9. Límites de la entrega

Alcance local, puertos loopback, Mailpit sin proveedor externo y rate limit en
memoria de una instancia. TypeORM synchronize/dropSchema/migrationsRun siguen false.
El comando de inicialización SQL no sirve para reparar una base ya poblada ni
como migración incremental. Mantener volúmenes y keyrings; las claves privadas
requieren custodia local fuera del repositorio. Las condiciones del verificador
global para probar el primer ADMIN no justifican eliminar una cuenta real.

No se afirma preparación de producción ni ausencia de hallazgos de desarrollo
por la auditoría limitada a producción. La integración externa se identifica
como pendiente, con sus decisiones documentadas, sin respuestas ficticias.

## 10. Cierre y aceptación

Se entregan los elementos solicitados: código modular compilado/verificado en G,
persistencia original, validación, JWT/RBAC y sesiones reales, correo local,
bootstrap ADMIN usable, Swagger y contratos exportables, Docker, pruebas y guía.
Los criterios locales A–H se cumplen con evidencias diferenciadas por fase.
No se modificaron otros microservicios, SQL global o contrato externo; no hay
Azure/Render, CD, publicación de imágenes, commits/pushes ni despliegue.

La secuencia autorizada termina aquí. No queda una fase posterior aprobada por
defecto; cualquier nueva integración o despliegue requiere una solicitud separada.
