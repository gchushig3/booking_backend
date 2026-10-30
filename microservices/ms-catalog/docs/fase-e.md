# Fase E — Seguridad provisional y bloqueo de integración Identity

Fecha: 2026-10-28 (America/Guayaquil). Autorización: «Vamos con la fase E».

## Resultado y límites

Se elimina el acceso administrativo anónimo mediante un guard global registrado en configureApplication,
con denegación por defecto. Solo los handlers con @PublicEndpoint tienen acceso público.
No se implementa un verificador JWT, ni RBAC, ni se considera autenticado ningún usuario.
La fase E queda parcialmente completada; la integración real está bloqueada por contrato ausente.
No se inicia Fase F ni se realiza despliegue.

## Evidencia contractual

ms_identity/src/app.module.ts y app.controller.ts contienen únicamente el esqueleto NestJS.
La búsqueda en contracts, Identity y documentación Catalog no encontró perfil aprobado de tokens.
Booking OpenAPI v3 declara Bearer JWT, pero no define issuer, audience, algoritmo, claves,
claims de Identity ni correspondencia con operador_usuario.usu_id.
SQL define opeu_cargo como texto: no autoriza inferir roles RBAC de ese campo.

Se necesitan antes de habilitar administración:

- Perfil firmado: issuer, audience, algoritmo permitido, mecanismo de claves/rotación, expiración y revocación.
- Claims y vínculo verificable del sujeto con usu_id (bigint).
- Matriz aprobada de roles/permisos por operación, gestión de asociaciones y publicación.
- Política de propiedad por operador: asociación activa y operador activo, alcance por atracción,
  comprobación de operador original y destino si se permite reasignación; nunca confiar en IDs del cliente.

No se construye un consumidor Review ni validadores Location/Identity sin sus contratos.
No se inventan transiciones de estados. Esto no impide aplicar el cierre administrativo seguro.

## Contrato efectivo y matriz de acceso

| Operaciones                                                   | Acceso actual                                        |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| GET /api/v2/atracciones y GET /api/v2/atracciones/:id         | Público, reglas existentes de publicación            |
| POST /api/v2/atracciones/search                               | Público                                              |
| GET /api/v2/atracciones/categorias y /arbol                   | Público, solo activas                                |
| GET /api/v2/idiomas y /api/v2/inclusiones                     | Público                                              |
| GET /api/v2/health/live                                       | Público, sin datos sensibles                         |
| Todas las escrituras y todas las rutas de operadores/usuarios | 401 AUTHENTICATION_UNAVAILABLE                       |
| GET /api/v2/idiomas/:id y /api/v2/inclusiones/:id             | 401, no incluidas entre consultas públicas aprobadas |
| Nuevos handlers sin anotación pública                         | Denegados por defecto                                |

Sin cabecera, Bearer arbitrario, JWT sin firma y otros esquemas reciben la misma denegación;
no se decodifican claims ni se aceptan roles enviados por el consumidor. Guard antes de pipes/servicios.
Los errores conservan application/problem+json y X-Correlation-Id. Swagger identifica las rutas
protegidas y su 401 provisional. Swagger UI permanece accesible como documentación.
Los logs de errores inesperados no incluyen mensajes, consultas ni stack traces potencialmente sensibles.

## Archivos

- src/common/public-endpoint.decorator.ts: autorización explícita de consultas públicas.
- src/common/guards/administrative-access.guard.ts: guard provisional de denegación.
- src/configure-application.ts: instalación global, compartida con e2e.
- Cinco controladores de módulos y health.controller.ts: anotaciones de acceso/documentación.
- categories.controller.ts: fuerza active=true para consulta pública.
- problem-details.filter.ts: logs de errores sin contenido sensible.
- test/e2e/api-v2.e2e-spec.ts: matriz de denegación para cada ruta administrativa existente,
  cuatro variantes de Authorization, Problem Details y filtro de categorías.
- test/e2e/security.e2e-spec.ts: comprueba denegación de futuras rutas sin decoradores.
- README.md y docs/fase-e.md: estado real y bloqueos.

## Verificación

Comandos desde microservices/ms-catalog: npm.cmd run lint, npm.cmd run typecheck,
npm.cmd run build, npm.cmd test y npm.cmd run test:e2e.
PowerShell bloqueó npm.ps1 por su política local; se utilizó npm.cmd sin modificarla.
Resultados finales registrados tras la ejecución: lint, typecheck y build aprobados;
52 pruebas unitarias y 41 pruebas e2e HTTP aprobadas.
Las pruebas HTTP usan servicios de prueba, no demuestran persistencia ni integración real con Identity.
No se ejecutó PostgreSQL/Docker en esta fase, no hubo cambios de esquema ni dependencias nuevas.
Creación autenticada, RBAC, propiedad y casos 403 quedan pendientes: no existe identidad verificable.

## Aceptación y continuación

Cumplidos: cierre administrativo, consultas públicas explícitas, rechazo de tokens arbitrarios,
protección por defecto de nuevas rutas, errores correlacionados, compilación y pruebas ejecutadas.
Pendientes: verificación criptográfica, permisos y propiedad real contra operador_usuario.
La ubicación preexistente sigue siendo microservices/ms-catalog dentro del workspace;
no se creó un repositorio Git independiente ni se modificaron otros microservicios.
Solicitar el contrato Identity y la matriz de permisos para completar E; solicitar aprobación explícita
antes de comenzar F.
