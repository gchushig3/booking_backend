# Fase C — Persistencia

Fecha: 2026-10-28, America/Guayaquil. Autorización explícita para Fase C recibida del usuario.
No se inicia Fase D.

## 1. Resumen

Persistencia implementada exclusivamente en el repositorio independiente ms-catalog.
Se preservó el bloque SQL v2 de Catalog, se mapearon sus diez tablas y vista en TypeORM y se verificó PostgreSQL 16 real.
El SQL maestro y los demás microservicios no se modificaron. No hubo despliegue ni publicación remota.

## 2. Archivos creados o modificados

Nuevos:

- src/database/entities/: diez archivos .entity.ts, atraccion-completa.view.ts e index.ts.
- src/database/catalog-domains.ts: soporte acotado para los cuatro dominios PostgreSQL aprobados.
- src/database/apply-catalog-schema.ts: aplicación transaccional con comprobación de destino y bloqueo asesor.
- database/migrations/001-catalog.sql y SHA256SUMS: bloque aprobado y huella.
- database/source.json y schema-manifest.json: procedencia y manifiesto esperado extraído del SQL.
- database/docker-init.sh: bootstrap PostgreSQL para volúmenes nuevos.
- compose.test.yaml, test/jest-integration.config.mjs y test/integration/catalog.integration-spec.ts.
- test/unit/catalog-domains.spec.ts y scripts/verify-docker-bootstrap.mjs.
- scripts/apply-schema.mjs, .gitattributes y este informe.

Actualizados:

- src/database/database-options.ts y src/app.module.ts: registro de entidades y fábrica DataSource.
- scripts/prepare-local-env.mjs: entorno de pruebas aislado, sin sobrescritura de credenciales.
- package.json: comandos de inicialización y pruebas, sin cambiar dependencias.
- compose.yaml: montaje readonly del SQL y bootstrap en PostgreSQL.
- README.md: operación, persistencia, pruebas, límites y pendientes actuales.

.env.test se generó localmente con contraseña aleatoria y quedó ignorado por Git. .env existente se conservó.
No se copiaron claves, archivos de entorno ni código de otros microservicios.

## 3. Decisiones técnicas aplicadas

Se conservaron nombres de tablas/columnas, tipos, nulabilidad, defaults, PK identity ALWAYS y compuestas,
FK internas con sus acciones, CHECK, UNIQUE, índices, dominios, UUID, triggers, vista y seeds.
BIGINT y NUMERIC se mapean como string; no hay conversión global a number ni pérdida de precisión.

Los dominios dom_correo, dom_ruc, dom_telefono y dom_moneda se mantienen como dominios, tanto en PostgreSQL
como en los metadatos ORM. TypeORM 0.3 no enumera nombres de dominios personalizados: la fábrica amplía
supportedDataTypes únicamente para esos cuatro nombres por instancia DataSource. No se parchea node_modules
ni un driver global. Su compatibilidad se verificó mediante persistencia real; requiere regresión al actualizar TypeORM.

synchronize, dropSchema y migrationsRun permanecen false. La fábrica rechaza activarlos; entidades y vista
excluyen sincronización. No se creó una tabla de historial: la base tiene exactamente las diez tablas aprobadas.
Los scripts controlados sustituyen aquí un runner de migraciones TypeORM con historial adicional.

Los timestamps se obtienen de PostgreSQL y no se escriben por save ORM. Los triggers originales siguen vigentes.
DeleteDateColumn utiliza atr_eliminado_en. Las proyecciones Review tienen insert/update deshabilitados en save ORM;
esto no implementa un consumidor ni sustituye las futuras reglas de DTO/autorización.
No se añadieron FK ni relaciones ORM para prov_id, ciu_id o usu_id externos.

Referencia técnica: [entidades, BIGINT y soft delete de TypeORM](https://typeorm.io/docs/entity/entities/),
[driver PostgreSQL](https://typeorm.io/docs/drivers/postgres/).

## 4. Contratos implementados

Contrato de persistencia: las diez tablas y v_atraccion_completa del SQL v2.
Contrato operativo: inicialización manual local solo sobre base Catalog vacía, PostgreSQL 16, con huella SQL verificada,
transacción y advisory lock. Una base con objetos existentes se rechaza sin recrear objetos ni duplicar seeds.
El bootstrap Docker usa checksum y psql --single-transaction --set ON_ERROR_STOP=on, solo sobre un volumen nuevo.

No se agregaron endpoints, DTOs, permisos ni contratos externos. Permanece únicamente GET /api/v2/health/live.
La vista conserva borradores y RUC, por lo que no puede exponerse como respuesta pública directa.

## 5. Comandos ejecutados

En PowerShell se utilizó npm.cmd, sin modificar ExecutionPolicy:

```sh
npm run env:test
docker compose --env-file .env.test -f compose.test.yaml config --quiet
docker compose --env-file .env.test -f compose.test.yaml --progress quiet up -d --wait --wait-timeout 90
npm run lint
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run test:integration
npm run db:apply
npm run test:docker-bootstrap
docker compose --progress quiet up --build -d --wait --wait-timeout 120
docker compose ps
docker compose --env-file .env.test -f compose.test.yaml ps
git check-ignore .env .env.test node_modules dist
```

También se ejecutaron Prettier y verificaciones Node de solo lectura para contrastar el SQL con la fuente,
consultar el catálogo PostgreSQL, arrancar AppModule compilado y consultar HTTP desde el host.
No se instalaron nuevas dependencias ni se ejecutaron comandos contra bases de otros microservicios.

## 6. Resultados reales

| Verificación                                          | Resultado                                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| Lint final                                            | Aprobado                                                                          |
| Typecheck src/test                                    | Aprobado                                                                          |
| Build                                                 | Aprobado                                                                          |
| Jest unitarias                                        | 23 aprobadas, dos suites                                                          |
| Jest integración PostgreSQL 16                        | 50 aprobadas, una suite                                                           |
| Jest/Supertest HTTP existente                         | 2 aprobadas, una suite                                                            |
| Docker bootstrap, volumen nuevo y reinicio            | Aprobado: diez tablas, cuatro idiomas y seis categorías conservados               |
| Docker rollback de SQL fallido                        | Aprobado: cero tablas y cero dominios Catalog tras fallo transaccional            |
| Copia SQL frente al bloque maestro                    | Idéntica tras normalizar LF y excluir solo connect/comentarios de otros servicios |
| AppModule compilado con entidades y consulta ORM real | Aprobado                                                                          |
| HTTP desde host                                       | 200, {"status":"UP"}                                                              |
| Compose app/postgres local y postgres de pruebas      | Saludables                                                                        |
| Contenedores temporales de bootstrap                  | Eliminados por la prueba                                                          |

Total Jest: 75 casos aprobados. Adicionalmente pasaron los dos escenarios Docker del script de bootstrap.
No se confunden las dos pruebas HTTP de infraestructura con una suite de negocio/autorización.

La integración comprueba estructura por tabla contra un manifiesto derivado del SQL: columnas, tipos, dominios,
nulabilidad, precisión/escala, longitudes, identidad y defaults. También verifica PK/UNIQUE/CHECK/FK declarados,
índices y GIN, referencias exclusivamente internas, seeds, UUID, BIGINT mayor al máximo seguro de JavaScript,
relaciones, vista, borrado lógico y retención de enlaces, protección ORM de proyecciones Review,
rechazos SQL, cascadas y restricciones, timestamps, orden de fotografías, búsqueda y paginación.

Cada caso usa transacción y savepoints para errores esperados; se revierten las fixtures.
La limpieza verifica tablas incluso con borrados lógicos y confirma únicamente los seeds originales.
Las secuencias pueden avanzar durante los tests porque PostgreSQL no revierte nextval.
Las pruebas usan exclusivamente ms_catalog_test en loopback:5445.

Inventario real verificado en ms_catalog después de aplicar el inicializador:

```json
{
  "database": "ms_catalog",
  "tables": 10,
  "views": 1,
  "domains": 4,
  "indexes": 12,
  "triggers": 2,
  "languages": 4,
  "categories": 6,
  "operators": 0,
  "attractions": 0
}
```

SHA-256 del bloque aplicado:

```text
a2fa43418443e060597f967d67c28b7f40dcd21d95a60be382fad9fe44ace75e
```

## 7. Errores corregidos y bloqueos

Se corrigió el uso de genéricos de QueryRunner con la versión TypeORM instalada: las lecturas tipadas usan
runner.manager.query y siguen en la misma transacción.
La primera suite de integración obtuvo 47/50: se corrigió el target de save para un objeto literal y la interpretación
del resultado de UPDATE RETURNING. La versión final pasa los 50 casos.
La prueba de fallo Docker esperaba inicialmente exit 1; psql devolvió exit 3. Se corrigió para reconocer salida no cero;
la verificación final de rollback pasó y limpió sus fixtures.
El generador de entorno ahora identifica correctamente .env.test en su mensaje y nunca sobrescribe archivos existentes.

No quedan bloqueos de persistencia de esta fase. No se ocultaron ni marcaron como aprobadas pruebas fallidas.

## 8. Riesgos y pendientes

Los dominios usan una adaptación acotada de un punto interno de TypeORM: conservar versión fijada y ejecutar
regresión al actualizar. No se promete generación automática de migraciones; el SQL controlado es la fuente de estructura.
El inicializador no repara esquemas parciales ni reemplaza datos. Futuras evoluciones requieren scripts revisados y aprobación.
Los seeds están en el mismo bloque canónico, no en un script duplicado.
La auditoría de dependencias no se repitió: no cambiaron dependencias. Se conserva como antecedente de Fase B
cero avisos de producción y seis avisos bajos en la cadena de desarrollo de Jest.

Fase D/E pendientes: ciclos indirectos de categorías con concurrencia, reglas de publicación y visibilidad,
DTOs, rutas y permisos de auxiliares, propiedad de operadores, JWT real, formatos Problem Details y correlación.
No se inventó ninguna transición ni se añadió un CHECK nuevo al SQL.
Pendientes externos: documentos Plan, perfil Identity y vínculo subject/usu_id, APIs de validación Location/Identity,
evento RESENA_PUBLICADA y corrección del OpenAPI externo. No se construyeron integraciones ficticias.

La sonda sigue siendo liveness. El usuario PostgreSQL de bootstrap es local y no representa privilegios de producción.
Los servicios Compose quedan ejecutándose localmente; docker compose down conserva el volumen.
La prueba Docker verificó persistencia de esquema/seeds tras reinicio; persistencia de recursos a través de HTTP
corresponde a fases posteriores, porque esos endpoints aún no existen.

## 9. Criterios de aceptación cumplidos

Diez entidades y vista fieles al SQL; conexión TypeORM con dominios reales; DDL automático prohibido;
script Catalog independiente y verificable; inicialización local y de pruebas sin duplicación;
relaciones exclusivamente internas; restricciones y triggers verificados en PostgreSQL 16;
pruebas de persistencia, búsqueda/paginación y rollback; Docker reconstruido y saludable;
documentación de ejecución y limitaciones. Ningún archivo ajeno al repositorio ms-catalog fue modificado.
No se creó infraestructura ni hubo despliegue.

## 10. Autorización siguiente

Detener después de Fase C. Solicitar aprobación para comenzar Fase D con la formalización del contrato interno:
DTOs, métodos, rutas, respuestas, filtros, identificadores y permisos. Las decisiones abiertas deben resolverse
antes de implementar las operaciones que dependan de ellas. La integración JWT definitiva sigue condicionada al contrato Identity.
