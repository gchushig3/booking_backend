# Fase G — Pruebas y verificación global local

Fecha local: 2026-10-29, America/Guayaquil. Autorización: «Vamos con la Fase G».
Ejecución registrada: 20:15:55–20:17:41 locales (01:15:55–01:17:41 UTC del 30).
Se completa G; no se avanza a H ni se realiza despliegue.

## 1. Inspección

Se revisaron AGENTS.md, scripts npm y de verificación existentes, Compose local y
de test, informe F, suites de persistencia/auth/RBAC/OpenAPI y estado Docker.
Fuentes obligatorias leídas en A y preservadas: flujo_trabajo.md, SQL v2 y OpenAPI
externo Booking. No se modifican documentos originales ni otros microservicios.
AGENTS.md se refiere a telemetría de producción; no se activa para estas pruebas locales.

## 2. Trabajo realizado

Verificación reproducible mediante npm run verify:local, con 20 comprobaciones
aprobadas. Ejecuta compilación, calidad, pruebas, inicialización SQL controlada,
Docker, flujos reales de autenticación/autorización, Swagger y auditoría de producción.
Jest se ejecuta con reportes temporales para registrar recuentos reales y exigir
cero fallos y cero pruebas pendientes. No se añadieron endpoints ni se alteraron guards.

La configuración de ejecución verifica bases/puertos loopback, PostgreSQL 16,
esquema original y ausencia de ADMIN previo para los smokes de primer administrador.
Rechaza actuar sobre cuentas existentes en vez de promoverlas/eliminarlas.
Los artefactos E/F anteriores se respaldan y restauran byte por byte; sus resultados
de esta ejecución se incluyen dentro de la nueva evidencia G, sin secretos.

## 3. Archivos creados/modificados

- Nuevo scripts/verify-phase-g.mjs: orquestador local y registro de resultados.
- Nuevo docs/fase-g-evidence.json: resultados, tiempos, recuentos y estado antes/después.
- Nuevo docs/fase-g.md: este informe.
- package.json: comando verify:local.
- README.md: estado G y ejecución/prerrequisitos de la verificación.

No se modificó lógica de negocio, entidades, SQL, configuración JWT, contratos REST
o dependencias. El repositorio contiene además cambios previos E/F; se conservaron,
sin reset, commits, pushes ni modificaciones a otros servicios.

## 4. Contratos verificados

REST /api/v2; Swagger /api/docs; JSON/YAML OpenAPI 3 sincronizados; 25 operaciones
reales. JWT RS256, sesiones, refresh rotativo SHA-256, roles activos y bootstrap
seguro conforme a D/E. Se verifican BIGINT string, DTOs, Problem Details,
X-Correlation-Id, roles ADMIN/OPERADOR/CLIENTE originales, dominios y restricciones SQL.
No se modifica Booking ni se conecta directamente a bases de otros microservicios.

## 5. Endpoints y flujo funcional

Se mantienen 13 operaciones auth, nueve de usuarios/roles, JWKS y dos sondas.
http://localhost:3011/api/docs sigue público localmente. UI y documentos no
requieren JWT; operaciones protegidas mantienen 401/403 según autenticación y rol.
El ADMIN de prueba se obtiene mediante CLI real y login real, nunca por registro público.

| Caso obligatorio                         | Resultado comprobado                                       |
| ---------------------------------------- | ---------------------------------------------------------- |
| Registro válido / correo duplicado       | 201 / 409                                                  |
| Login válido sin JWT previo              | 200 con tokens                                             |
| Login inválido                           | 401 genérico                                               |
| auth/me sin token / con access válido    | 401 / 200                                                  |
| CLIENTE / OPERADOR en administración     | 403                                                        |
| ADMIN en administración                  | 200                                                        |
| Refresh válido / reutilizado             | Rotación 200 / rechazo 401 y revocación                    |
| Refresh concurrente                      | Un 200 y un 401; revocación efectiva                       |
| Logout / logout-all                      | Sesiones revocadas                                         |
| Access expirado / sesión expirada        | 401                                                        |
| Usuario inactivo                         | Acceso y login rechazados                                  |
| Rol inactivo                             | No concede permisos                                        |
| Recuperación de contraseña               | Correo real, token de un uso, sesiones revocadas           |
| Verificación de correo                   | Estado actualizado; token reutilizado rechazado            |
| Bootstrap ADMIN                          | Explícito, idempotente, sin promoción de CLIENTE           |
| Primer ADMIN fuera de entorno autorizado | Rechazado                                                  |
| Swagger y Try it out                     | Público, registro/login/me reales, CLIENTE 403 y ADMIN 200 |

## 6. Pendientes/bloqueos

Ninguna prueba omitida ni bloqueada en esta ejecución. No se desactivó seguridad.
Las cuentas ADMIN/CLIENTE temporales se eliminaron; para uso permanente sigue el
procedimiento explícito del README. Entrega H y cualquier trabajo de integración
con consumidores requieren aprobación posterior. Sin Azure, Render o despliegue.

## 7. Comandos ejecutados

Comando principal desde microservices/ms_identity: npm.cmd run verify:local.
El orquestador ejecutó efectivamente:

```sh
docker compose config --quiet
docker compose --env-file .env.test -f compose.test.yaml config --quiet
npm run lint
npm run typecheck
npm run build
npm run format:check
npm run openapi:check
npm test -- --json --outputFile=<temporal>
npm run test:e2e -- --json --outputFile=<temporal>
npm run test:integration -- --json --outputFile=<temporal>
npm run test:docker-bootstrap
docker compose up -d --build --wait
npm run test:local-stack
node scripts/verify-phase-e.mjs
docker compose restart app
npm run test:swagger-browser
docker compose restart postgres mailpit app
npm audit --omit=dev --json
```

También inspección del usuario/rootfs/imagen de app, recuentos SQL, huella SHA-256,
comparación de JWKS tras reinicio y estado final de los cuatro contenedores.
Los límites siguen normales: los smokes independientes usan ciclos separados de
app para no acumular intentos de login de fixtures entre escenarios. No se añade
un bypass ni se modifica configuración de límites o roles para hacerlos pasar.

## 8. Resultados reales

| Comprobación                              | Resultado                                    |
| ----------------------------------------- | -------------------------------------------- |
| Lint / typecheck / build host             | Aprobados                                    |
| Formato y OpenAPI sincronizado            | Aprobados                                    |
| Unitarias Jest                            | 44/44, cinco suites                          |
| E2E HTTP aisladas                         | 8/8, dos suites                              |
| Integración real                          | 59/59, cuatro suites                         |
| Total Jest                                | 111/111, 11 suites, cero omitidas            |
| SQL en volumen nuevo y reinicio           | Cinco tablas y tres roles originales         |
| SQL con fallo inyectado en copia temporal | Rollback: cero tablas y dominios             |
| Build/arranque Docker                     | Aprobado; app como node, rootfs solo lectura |
| Flujo ADMIN/CLIENTE/OPERADOR sobre Docker | Aprobado                                     |
| Swagger en Chrome con Try it out real     | Aprobado                                     |
| Claves públicas tras reiniciar app        | Mismo JWKS                                   |
| Estado SQL tras reiniciar stack           | Igual al inicial                             |
| npm audit de producción                   | Cero vulnerabilidades reportadas             |

PostgreSQL principal/test: versión 160015 (16.15); cinco tablas, tres dominios,
vista presente y tres roles activos. Antes/después: cero usuarios, sesiones,
tokens y asignaciones de prueba. Huella SQL inalterada:
84fa0e694dece975a098b4d22b725b589fb94fe0f071d8f4872740a2ddedb204.
Contenedores app, PostgreSQL, Mailpit y PostgreSQL de test saludables al finalizar;
contenedores temporales de bootstrap eliminados. Claves locales no se regeneran.

[Evidencia estructurada completa](fase-g-evidence.json) incluye 20 checks con
exit_code=0, duración, recuentos Jest, imagen Docker, snapshots SQL, resultados
Swagger/ADMIN y auditoría. No almacena passwords, access/refresh ni claves privadas.
No hubo fallos que exigieran corregir código de producción en esta fase.

## 9. Riesgos y límites

La ejecución global requiere Docker y Chrome locales, configuración/claves
preparadas y ausencia de asignaciones ADMIN previas para los smokes de bootstrap.
Una instalación con cuentas permanentes debe usar las suites aisladas y verificaciones
compatibles por separado, sin borrar cuentas reales para satisfacer el automatizador.
Persisten los límites aprobados: SMTP/claves locales, rate limit de una instancia
y política de vigencia pendiente para consumidores que verifican JWT offline.
La auditoría ejecutada cubre producción; no se afirma ausencia de hallazgos en
dependencias de desarrollo. Jest emite el aviso experimental de VM Modules.

## 10. Criterios y siguiente aprobación

Se cumple G con evidencia ejecutada de calidad, 111 pruebas, accesibilidad pública,
JWT/RBAC, PostgreSQL, SQL reproducible/rollback, Docker, navegador y limpieza.
No se cambió esquema, contrato externo ni otros microservicios. No se desplegó.
Se detiene antes de la entrega H y solicita autorización para Fase H — Entrega local.
