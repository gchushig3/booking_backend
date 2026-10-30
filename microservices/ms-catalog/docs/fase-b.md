# Fase B — Inicialización local

Fecha de entrega: 2026-10-28 (America/Guayaquil).
Autorización: aprobación explícita del usuario tras el informe de Fase A.
Alcance: inicialización. No se inicia Fase C.

## 1. Trabajo realizado

Repositorio Git independiente creado en D:/semestreVI/systems_integration/proyecto_v2/ms-catalog,
rama main, sin remote, commits ni publicación. No se modificaron archivos de booking-backend u otros servicios.
Se preparó NestJS 12 con TypeScript 6, configuración validada, conexión PostgreSQL mediante TypeORM,
Docker local y herramientas de comprobación. Las entidades y el SQL de negocio siguen pendientes.

## 2. Archivos

- src/main.ts, src/app.module.ts y src/configure-application.ts: arranque, logger JSON, prefijo y validación global.
- src/config/environment.ts: variables requeridas, puertos y aislamiento del nombre de base para pruebas.
- src/database/database-options.ts: PostgreSQL, pool y prohibición de DDL automático.
- src/health/health.controller.ts y health.module.ts: sonda del proceso.
- test/unit/environment.spec.ts y test/e2e/health.e2e-spec.ts: pruebas de configuración y HTTP.
- package.json, package-lock.json, tsconfig\*.json y nest-cli.json: proyecto y dependencias fijadas.
- eslint.config.mjs, jest.config.mjs, test/jest-e2e.config.mjs y .prettierrc.json: calidad y pruebas.
- Dockerfile, compose.yaml y .dockerignore: ejecución local.
- .env.example, .gitignore, .nvmrc y scripts/prepare-local-env.mjs: entorno reproducible.
- README.md y este informe: operación, límites y evidencias.

El archivo .env generado localmente está ignorado por Git; contiene una contraseña aleatoria que no se imprimió.
node_modules y dist también están ignorados. No se creó docs/openapi.yaml ni un contrato de negocio provisional.

## 3. Decisiones técnicas

Node 24, NestJS 12.3.2, TypeScript 6.0.3 y TypeORM 0.3.31, con módulos ESM.
Jest 30 y ts-jest en modo ESM; Supertest para HTTP. Jest requiere la bandera experimental de VM Modules.
ESLint 10 con reglas de tipado restringidas a archivos TypeScript. No se copiaron las dependencias de despliegue de otros proyectos.

Configuración validada al arrancar, sin valores secretos predeterminados. NODE_ENV=test exige ms_catalog_test.
synchronize=false, dropSchema=false y migrationsRun=false en todos los entornos.
No se aplica el SQL maestro, no hay entidades ni scripts de migración y no se crea historial adicional.

Compose usa PostgreSQL 16, volumen propio, healthcheck y reinicio limitado a tres fallos.
La imagen tiene etapas de dependencias, build y runtime; runtime usa node (UID 1000), filesystem de solo lectura,
/tmp temporal, capacidades eliminadas y no-new-privileges.
Los puertos 3014 y 5444 se publican exclusivamente en 127.0.0.1.
Se mantiene una red internal=true más una red bridge para acceso local. La segunda permite salida a Internet;
no se declara aislamiento total de egreso.

Referencias técnicas consultadas: [migración y requisitos ESM de NestJS](https://docs.nestjs.com/migration-guide),
[calendario oficial de Node.js](https://github.com/nodejs/Release).
Las versiones y peerDependencies se contrastaron con el registro npm antes de instalar.

## 4. Contratos implementados

Únicamente GET /api/v2/health/live: 200 application/json, cuerpo {"status":"UP"}, público.
Es una sonda del proceso HTTP. No certifica conectividad continua con PostgreSQL ni implementa el health externo de Booking.
La aplicación sí necesita inicializar su conexión TypeORM antes de escuchar.
No hay rutas administrativas ni mecanismos que concedan acceso provisional.

No hay DTOs de negocio, consumidor Review, adaptadores Identity/Location, Swagger ni respuesta Problem Details todavía.
Swagger /api/docs corresponde a Fase F; Problem Details y correlation ID deben estar listos antes de publicar negocio en Fase D.

## 5. Comandos ejecutados

Desde este repositorio, con npm.cmd en Windows:

```sh
git init --initial-branch=main
npm install --no-fund
npm install --save-dev --save-exact eslint@10.13.0 @eslint/js@10.0.1 --no-fund
node scripts/prepare-local-env.mjs
docker compose config --quiet
npm run lint
npm run typecheck
npm run build
npm test
npm run test:e2e
npm audit --json
npm audit --omit=dev --json
docker compose up -d postgres --wait --wait-timeout 120
docker compose --progress quiet up --build -d --wait --wait-timeout 120
docker compose --progress quiet up -d --wait --wait-timeout 90
docker compose ps
docker compose logs --tail 15 app
git status --short
git check-ignore .env node_modules dist
```

También se consultaron versiones y peerDependencies con npm view, se aplicó Prettier a los archivos creados,
y se ejecutaron comprobaciones Node de solo lectura contra HTTP y PostgreSQL.
No se ejecutó npm audit fix --force ni se cambió ExecutionPolicy.

## 6. Resultados observados

| Verificación                                         | Resultado                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| Lint final                                           | Aprobado, sin errores ni warnings                          |
| Typecheck de src y test                              | Aprobado                                                   |
| Build                                                | Aprobado                                                   |
| Pruebas unitarias                                    | 18 aprobadas, una suite                                    |
| Pruebas HTTP con HealthModule                        | 2 aprobadas, una suite                                     |
| Configuración Compose                                | Válida                                                     |
| Build de imagen local                                | Aprobado                                                   |
| Compose app y postgres                               | Ambos healthy                                              |
| GET desde host 127.0.0.1:3014/api/v2/health/live     | 200, {"status":"UP"}                                       |
| Bootstrap AppModule compilado contra PostgreSQL real | Aprobado; DataSource inicializado y consulta SQL ejecutada |
| Motor de base de datos                               | PostgreSQL 16.15, ms_catalog                               |
| Tablas BASE TABLE en public                          | 0; no se inició persistencia de Fase C                     |
| Opciones DDL de DataSource real                      | synchronize, dropSchema y migrationsRun desactivados       |
| Runtime Docker                                       | node, UID 1000, readOnly=true                              |
| .env dentro de /app en runtime                       | Ausente                                                    |
| Exclusiones Git                                      | .env, node_modules y dist ignorados                        |
| Auditoría de producción                              | 0 vulnerabilidades reportadas                              |
| Auditoría completa                                   | 6 avisos bajos, en la cadena de desarrollo Jest/deepmerge  |

Las comprobaciones SQL fueron SELECT de versión, nombre de base y conteo de tablas.
La comprobación del AppModule se ejecutó con NestFactory y DataSource reales, sin mocks de PostgreSQL.
No se confunde esta comprobación de arranque con una suite de persistencia: entidades, relaciones, restricciones,
seeds y búsquedas aún no existen y no se probaron.

## 7. Incidencias y correcciones

El sandbox no tenía acceso al motor Docker ni escritura en la carpeta hermana. Se usó ejecución con permisos
para la ubicación y operación local aprobadas; no se modificaron permisos del sistema.
La primera configuración de lint extendía reglas tipadas a un archivo .mjs. Se corrigió su alcance y los tipos
señalados por lint; después pasaron lint, typecheck y las pruebas.
Docker no publicó puertos cuando los servicios solo pertenecían a internal=true. Se añadió bridge local y se
repitió la comprobación desde el host. Los contenedores finales están saludables y con puertos loopback.
Una comprobación inicial esperaba encontrar una conexión idle en pg_stat_activity; el pool puede cerrarla
por inactividad. Se sustituyó esa inferencia por la inicialización y consulta real del DataSource en AppModule.

## 8. Riesgos y pendientes

Los seis avisos de desarrollo derivan de deepmerge y se propagan por Jest. La remediación sugerida por npm
retrocede versiones mayores; no se aplicó automáticamente. No hay avisos de producción en la auditoría ejecutada.
Se observaron advertencias de instalación sobre scripts opcionales bloqueados por la política npm del entorno;
no se habilitaron y no impidieron las verificaciones realizadas.

La sonda es de liveness, no de readiness. El PostgreSQL inicializado usa un usuario local de bootstrap;
no representa una política final de privilegios para producción. No se afirma preparación para desplegar.
El tag Node 24 se resuelve al construir; la imagen probada ejecuta Node 24.22.1 y el host usa 24.21.0.

Persisten los pendientes de Fase A: documentos Plan, corrección de claves duplicadas del OpenAPI externo,
contrato REST interno, transiciones de publicación, políticas de visibilidad y borrado de auxiliares,
perfil JWT/RBAC y vínculo del sujeto con usu_id, APIs Identity/Location y evento RESENA_PUBLICADA.
No bloquean esta inicialización; sí bloquean las implementaciones dependientes.

## 9. Criterios de aceptación de Fase B

Cumplidos: repositorio independiente; NestJS compilable; TypeScript estricto; variables validadas;
PostgreSQL configurado y accesible; Dockerfile multietapa; Compose ejecutado con salud, volumen y red;
usuario no root; entorno sin secretos versionados; herramientas de pruebas funcionando; documentación local.
No se crearon objetos SQL, no se modificaron otros microservicios y no hubo despliegue ni publicación remota.
Los contenedores de Catalog se dejan ejecutándose localmente; detener con docker compose down conserva el volumen.

## 10. Siguiente autorización

Detener tras Fase B. Fase C requiere autorización explícita del usuario para mapear las diez entidades,
preservar el SQL mediante scripts controlados y ejecutar pruebas de persistencia en PostgreSQL 16.
